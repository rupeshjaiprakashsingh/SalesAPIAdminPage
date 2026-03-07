import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Dashboard, HomeLayout, Landing, Login, Logout, Register, UserManagement, Enquiries, LiveTracking, TimelineReport, CalendarReport } from "./pages";
import { ToastContainer } from "react-toastify";
import HomeDashboard from "./pages/HomeDashboard";
import MarkAttendance from "./pages/MarkAttendance";
import AttendanceList from "./pages/AttendanceList";
import GetAttendanceByIdDetails from "./pages/GetAttendanceByIdDetails";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeLayout />,
    children: [
      { index: true, element: <Landing /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      {
        path: "dashboard",
        element: <Dashboard />,
        children: [
          { index: true, element: <HomeDashboard /> },
          { path: "attendance", element: <MarkAttendance /> },
          { path: "attendance-list", element: <AttendanceList /> },
          { path: "attendance/:id", element: <GetAttendanceByIdDetails /> },
          { path: "reports", element: <Reports /> },
          { path: "profile", element: <Profile /> },
          { path: "users", element: <UserManagement /> },
          { path: "enquiries", element: <Enquiries /> },
          { path: "live-tracking", element: <LiveTracking /> },
          { path: "timeline-report", element: <TimelineReport /> },
          { path: "calendar-report", element: <CalendarReport /> }
        ]
      },
      { path: "logout", element: <Logout /> }
    ]
  }
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer position="top-center" />
    </>
  );
}
//Done
export default App;
