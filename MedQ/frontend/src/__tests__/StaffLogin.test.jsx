import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffLogin from "../pages/StaffLogin";

// Mock navigation to track successful login redirects
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

describe("StaffLogin", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // Tests the happy path: valid credentials should redirect to dashboard
  test("logs in successfully with correct credentials", async () => {
    render(<StaffLogin />);

    await userEvent.type(screen.getByLabelText(/staff id/i), "admin");
    await userEvent.type(screen.getByLabelText(/password/i), "admin");
    await userEvent.click(
      screen.getByRole("button", { name: /confirm/i })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/staff-dashboard");
  });

  // Ensures invalid credentials show an error and do not navigate
  test("shows error message on invalid credentials", async () => {
    render(<StaffLogin />);

    await userEvent.type(screen.getByLabelText(/staff id/i), "wrong");
    await userEvent.type(screen.getByLabelText(/password/i), "nope");
    await userEvent.click(
      screen.getByRole("button", { name: /confirm/i })
    );

    expect(
      screen.getByText(/invalid credentials/i)
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});