import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import QueueStatus from "../pages/QueueStatus";

// Mock apiRequest so tests don’t hit a real backend
jest.mock("../apiClient", () => ({
  apiRequest: jest.fn(),
}));
import { apiRequest } from "../apiClient";

// Mock react-router hooks used by the page
jest.mock("react-router-dom", () => ({
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
}));

import { useLocation, useNavigate } from "react-router-dom";

// IMPORTANT: Mock the WebSocket hook so QueueStatus won’t throw
jest.mock("../contexts/WebSocketContext", () => ({
  useWebSocket: () => ({ socket: null }), // QueueStatus can safely run without a socket
}));

describe("QueueStatus", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    useNavigate.mockReturnValue(jest.fn());
  });

  test("loads visit data and displays queue number", async () => {
    // This test verifies: the page fetches /visit/:id and shows queue number + predicted wait
    useLocation.mockReturnValue({
      state: {
        visitId: "abc123",
        anonToken: "token123",
        department: "Emergency",
        initialWait: 10,
        severity: 3,
      },
    });

    apiRequest.mockResolvedValueOnce({
      visit: {
        visit_id: "abc123",
        predicted_wait_minutes: 12,
        queue_position: 7,
      },
    });

    render(<QueueStatus />);

    // Wait until the queue number appears
    expect(await screen.findByText("7")).toBeInTheDocument();

  });

  test("shows warning when queue position is missing", async () => {
    // This test verifies: if API returns a visit but no queue position, user sees warning
    useLocation.mockReturnValue({
      state: {
        visitId: "abc123",
        anonToken: "token123",
        department: "Emergency",
        initialWait: 10,
        severity: 3,
      },
    });

    apiRequest.mockResolvedValueOnce({
      visit: {
        visit_id: "abc123",
        predicted_wait_minutes: 10,
        // queue_position missing on purpose
      },
    });

    render(<QueueStatus />);

    expect(
      await screen.findByText(/visit loaded, but queue position is missing/i)
    ).toBeInTheDocument();
  });

  test("countdown timer decreases over time", async () => {
    // This test verifies: the countdown decreases by 1 second as time passes
    jest.useFakeTimers();

    useLocation.mockReturnValue({
      state: {
        visitId: "abc123",
        anonToken: "token123",
        department: "Emergency",
        initialWait: 1, // 1 minute
        severity: 2,
      },
    });

    apiRequest.mockResolvedValueOnce({
      visit: {
        visit_id: "abc123",
        predicted_wait_minutes: 1,
        queue_position: 1,
      },
    });

    render(<QueueStatus />);

    // Wait for initial render to show 01:00
    expect(await screen.findByText("01:00")).toBeInTheDocument();

    // Advance time by 2 seconds inside act() to avoid act warnings
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Now the time should be 00:58
    expect(screen.getByText("00:58")).toBeInTheDocument();

    jest.useRealTimers();
  });
});