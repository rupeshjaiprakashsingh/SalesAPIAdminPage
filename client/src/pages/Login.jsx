import React, { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import Logo from "../assets/logo.png";
import GoogleSvg from "../assets/icons8-google.svg";
import "../styles/Login.css";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const token = JSON.parse(localStorage.getItem("auth")) || "";
  const navigate = useNavigate();

  useEffect(() => {
    if (token !== "") {
      toast.success("You are already logged in");
      navigate("/dashboard");
    }
  }, []);

  // -------------------------
  // Yup Validation Schema
  // -------------------------
  const validationSchema = Yup.object({
    username: Yup.string()
      .trim()
      .required("Username is required"),

    password: Yup.string()
      .min(6, "Password must be at least 6 characters")
      .required("Password is required"),
  });

  // -------------------------
  // Formik Setup
  // -------------------------
  const formik = useFormik({
    initialValues: {
      username: "",
      password: "",
    },
    validationSchema,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values) => {
      try {
        const response = await axios.post("/api/v1/login", values);
        localStorage.setItem("auth", JSON.stringify(response.data.token));

        toast.success(`Welcome back, ${response.data.name}!`);
        navigate("/dashboard");
      } catch (err) {
        toast.error(err?.response?.data?.msg || err.message);
      }
    },
  });

  return (
    <div className="login-main">
      <div className="login-left">
        <div className="auth-illustration">
          <div className="auth-brand-icon">
            <i className="ri-pulse-line"></i>
          </div>
          <h1>SalesAdmin</h1>
          <p>The professional platform for managing your sales team's attendance, tracking, and performance in real-time.</p>
          <div className="auth-features">
            <div className="auth-feature-item">
              <div className="auth-feature-icon"><i className="ri-map-pin-time-line"></i></div>
              GPS-tagged attendance tracking
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon"><i className="ri-map-2-line"></i></div>
              Live staff location monitoring
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon"><i className="ri-bar-chart-2-line"></i></div>
              Advanced reports & analytics
            </div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-container">
          <div className="login-logo">
            <img src={Logo} alt="SalesAdmin" />
            <div className="login-logo-text">Sales<span>Admin</span></div>
          </div>

          <div className="login-center">
            <h2>Welcome back!</h2>
            <p>Please enter your details</p>

            <form onSubmit={formik.handleSubmit}>

              {/* USERNAME */}
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={
                  formik.touched.username && formik.errors.username ? "input-error" : ""
                }
              />
              {formik.touched.username && formik.errors.username && (
                <p className="error-text">{formik.errors.username}</p>
              )}

              {/* PASSWORD */}
              <div className="pass-input-div">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={
                    formik.touched.password && formik.errors.password
                      ? "input-error"
                      : ""
                  }
                />

                {showPassword ? (
                  <FaEyeSlash onClick={() => setShowPassword(!showPassword)} />
                ) : (
                  <FaEye onClick={() => setShowPassword(!showPassword)} />
                )}
              </div>

              {formik.touched.password && formik.errors.password && (
                <p className="error-text">{formik.errors.password}</p>
              )}

              <div className="login-center-options">
                <div className="remember-div">
                  <input type="checkbox" id="remember-checkbox" />
                  <label htmlFor="remember-checkbox">Remember for 30 days</label>
                </div>
                <a href="#" className="forgot-pass-link">
                  Forgot password?
                </a>
              </div>

              <div className="login-center-buttons">
                <button type="submit">Log In</button>

                <button type="button">
                  <img src={GoogleSvg} alt="" />
                  Log In with Google
                </button>
              </div>
            </form>
          </div>

          <p className="login-bottom-p">
            Don't have an account? <Link to="/register">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
