import React from "react";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import QueueStatus from "../pages/QueueStatus";

jest.mock("../apiClient", () => ({
  apiRequest: jest.fn(),
}));
import { apiRequest } from "../apiClient";

// Make location start with initialWait = 0 so the countdown DOES NOT run by default.
// Only the countdown test will turn it on by returning predicted_wait_minutes = 1.
jest.mock("react-router-dom", () => ({
  useLocation: () => ({
    state: {
      visitId: "123",
      anonToken: "token-abc",
      department: "Emergency",
      initialWait: 0,
      severity: 3,
    },
  }),
  useNavigate: () => jest.fn(),
}));

describe("QueueStatus", () => {
  afterEach(() => {
    // Ensure component unmounts so its intervals are cleaned up
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("loads visit data and displays queue number", async () => {
    // This test verifies the visit endpoint is called and queue_position renders.
    // predicted_wait_minutes is 0 so the countdown interval never starts.
    apiRequest.mockResolvedValueOnce({
      visit: { queue_position: 7, predicted_wait_minutes: 0 },
    });

    render(<QueueStatus />);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/visit/123");
    });

    expect(await screen.findByText("7")).toBeInTheDocument();
  });

  test("shows warning when queue position is missing", async () => {
    // This test verifies the UI shows an error message if the API returns no queue position.
    // predicted_wait_minutes is 0 so the countdown interval never starts.
    apiRequest.mockResolvedValueOnce({
      visit: { predicted_wait_minutes: 0 },
    });

    render(<QueueStatus />);

    expect(
      await screen.findByText(/queue position is missing/i)
    ).toBeInTheDocument();
  });

  test("countdown timer decreases over time", async () => {
    // This test verifies the countdown ticks down each second.
    // We use fake timers and advance time inside act().
    jest.useFakeTimers();

    apiRequest.mockResolvedValueOnce({
      visit: { queue_position: 1, predicted_wait_minutes: 1 }, // 60 seconds
    });

    render(<QueueStatus />);

    // Wait until the timer text shows up as 01:00
    expect(await screen.findByText("01:00")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(await screen.findByText("00:57")).toBeInTheDocument();
  });
});