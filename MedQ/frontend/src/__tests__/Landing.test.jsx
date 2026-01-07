import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Landing from "../pages/Landing";

// Mock navigation so we can assert route changes without a real router
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

describe("Landing page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // Verifies that the main landing content renders
  test("renders app title and patient check-in button", () => {
    render(<Landing />);

    expect(screen.getByText("Med-Q")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /patient check-in/i })
    ).toBeInTheDocument();
  });

  // Ensures clicking the button sends the user to the patient check-in flow
  test("navigates to patient check-in when button is clicked", async () => {
    render(<Landing />);

    await userEvent.click(
      screen.getByRole("button", { name: /patient check-in/i })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/patient-checkin");
  });

  // Confirms staff login link points to the correct route
  test("staff login link routes to staff login page", () => {
    render(<Landing />);

    const link = screen.getByRole("link", { name: /here/i });
    expect(link).toHaveAttribute("href", "/staff-login");
  });
});