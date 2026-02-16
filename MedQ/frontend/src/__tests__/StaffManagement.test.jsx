import React from "react";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffManagement from "../pages/StaffManagement";

// Mock apiRequest so tests don't hit a real backend
jest.mock("../apiClient", () => ({
  apiRequest: jest.fn(),
}));
import { apiRequest } from "../apiClient";

// Mock TabSwitcher so tests are not coupled to it
jest.mock("../components/TabSwitcher", () => () => (
  <div data-testid="tab-switcher">tabs</div>
));

// Build a controllable mock socket where we can trigger events manually
const handlers = {};
const mockSocket = {
  on: jest.fn((event, cb) => {
    handlers[event] = cb;
  }),
  off: jest.fn((event) => {
    delete handlers[event];
  }),
};

// Mock WebSocket context hook used by StaffManagement
jest.mock("../contexts/WebSocketContext", () => ({
  useWebSocket: () => ({ socket: mockSocket }),
}));

describe("StaffManagement", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
  });

  afterEach(() => {
    cleanup();
  });

  test("renders page header and department dropdown", async () => {
    // This test checks the basic page chrome renders, even with empty staff
    apiRequest.mockResolvedValueOnce({ staff: [] });

    render(<StaffManagement />);

    expect(screen.getByRole("heading", { name: /staff management/i })).toBeInTheDocument();
    expect(screen.getByTestId("tab-switcher")).toBeInTheDocument();

    // Department dropdown exists (combobox = select)
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // Wait for initial fetch to complete by waiting for the On Duty heading
    expect(await screen.findByRole("heading", { name: /on duty/i })).toBeInTheDocument();
  });

  test("shows loading state first, then renders staff grouped by duty status", async () => {
    // This test checks: Loading indicator appears, then On Duty/Off Duty sections populate properly
    apiRequest.mockResolvedValueOnce({
      staff: [
        {
          staff_id: 1,
          name: "Alice",
          role: "nurse",
          on_duty: true,
          active: true,
          department_name: "Emergency",
          clock_in: "2025-12-01T12:00:00Z",
        },
        {
          staff_id: 2,
          name: "Bob",
          role: "doctor",
          on_duty: false,
          active: true,
          department_name: "Radiology",
          clock_in: null,
        },
      ],
    });

    render(<StaffManagement />);

    // Verifies loading UI is shown immediately
    expect(screen.getByText(/loading staff/i)).toBeInTheDocument();

    // Verifies both sections exist and have correct counts
    expect(await screen.findByText(/on duty\s*\(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/off duty\s*\(1\)/i)).toBeInTheDocument();

    // Verifies staff cards exist
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // Verifies the on-duty card shows a clock-in label
    expect(screen.getByText(/clocked in:/i)).toBeInTheDocument();
  });

  test("filters out roles that are not nurse, physician, or doctor", async () => {
    // This test checks that unsupported roles never appear in the UI
    apiRequest.mockResolvedValueOnce({
      staff: [
        {
          staff_id: 1,
          name: "Allowed Nurse",
          role: "nurse",
          on_duty: true,
          active: true,
          department_name: "Emergency",
          clock_in: "2025-12-01T12:00:00Z",
        },
        {
          staff_id: 2,
          name: "Filtered Out",
          role: "janitor",
          on_duty: false,
          active: true,
          department_name: "Emergency",
          clock_in: null,
        },
      ],
    });

    render(<StaffManagement />);

    expect(await screen.findByText("Allowed Nurse")).toBeInTheDocument();
    expect(screen.queryByText("Filtered Out")).not.toBeInTheDocument();
  });

  test("changing department filter calls /staff?department=... and updates list", async () => {
    // This test checks: selecting a department triggers a new API call with the query param
    apiRequest
      .mockResolvedValueOnce({ staff: [] }) // initial load with "all"
      .mockResolvedValueOnce({
        staff: [
          {
            staff_id: 3,
            name: "Cardio Doc",
            role: "doctor",
            on_duty: false,
            active: true,
            department_name: "Cardiology",
            clock_in: null,
          },
        ],
      });

    render(<StaffManagement />);

    // Wait for initial load to finish (heading is reliable and unique)
    await screen.findByRole("heading", { name: /on duty/i });

    // Change filter to Cardiology
    await userEvent.selectOptions(screen.getByRole("combobox"), "Cardiology");

    // Verify API was called with the correct query string
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/staff?department=Cardiology");
    });

    // Verify new staff appears
    expect(await screen.findByText("Cardio Doc")).toBeInTheDocument();
  });

  test("clocking in calls POST /staff/:id/clock-in then reloads staff", async () => {
    // This test checks: clicking Clock In triggers the POST call and then refreshes list
    apiRequest
      .mockResolvedValueOnce({
        staff: [
          {
            staff_id: 10,
            name: "Off Duty Nurse",
            role: "nurse",
            on_duty: false,
            active: true,
            department_name: "Emergency",
            clock_in: null,
          },
        ],
      }) // initial load
      .mockResolvedValueOnce({ ok: true }) // POST clock-in
      .mockResolvedValueOnce({
        staff: [
          {
            staff_id: 10,
            name: "Off Duty Nurse",
            role: "nurse",
            on_duty: true,
            active: true,
            department_name: "Emergency",
            clock_in: "2025-12-01T12:00:00Z",
          },
        ],
      }); // reload

    render(<StaffManagement />);

    // Ensure staff shows up
    expect(await screen.findByText("Off Duty Nurse")).toBeInTheDocument();

    // Click Clock In
    await userEvent.click(screen.getByRole("button", { name: /clock in/i }));

    // Verify POST call was made
    expect(apiRequest).toHaveBeenCalledWith("/staff/10/clock-in", { method: "POST" });

    // Verify reload result shows staff in on-duty section
    expect(await screen.findByText(/on duty\s*\(1\)/i)).toBeInTheDocument();
  });

  test("websocket staff_update triggers reload", async () => {
    // This test checks: socket listener is registered and causes a reload when the event fires
    apiRequest
      .mockResolvedValueOnce({ staff: [] }) // initial load
      .mockResolvedValueOnce({
        staff: [
          {
            staff_id: 99,
            name: "Updated Staff",
            role: "physician",
            on_duty: true,
            active: true,
            department_name: "Emergency",
            clock_in: "2025-12-01T12:00:00Z",
          },
        ],
      }); // reload after socket event

    render(<StaffManagement />);

    // Ensure event subscription happened
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("staff_update", expect.any(Function));
    });

    // Trigger event inside act() because it causes setState
    act(() => {
      handlers.staff_update();
    });

    // Verify refreshed staff appears
    expect(await screen.findByText("Updated Staff")).toBeInTheDocument();
  });

  test("shows error banner when apiRequest fails", async () => {
    // This test checks: if the staff endpoint throws, the UI shows a readable error message
    apiRequest.mockRejectedValueOnce(new Error("Backend down"));

    render(<StaffManagement />);

    expect(await screen.findByText(/backend down/i)).toBeInTheDocument();
  });

  test("inactive off-duty staff shows Inactive label and no Clock In button", async () => {
    // This test checks: inactive staff should not be clocked in and should show an Inactive tag
    apiRequest.mockResolvedValueOnce({
      staff: [
        {
          staff_id: 5,
          name: "Inactive Person",
          role: "nurse",
          on_duty: false,
          active: false,
          department_name: "Emergency",
          clock_in: null,
        },
      ],
    });

    render(<StaffManagement />);

    expect(await screen.findByText("Inactive Person")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clock in/i })).not.toBeInTheDocument();

    // Use exact match to avoid matching the name "Inactive Person"
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});