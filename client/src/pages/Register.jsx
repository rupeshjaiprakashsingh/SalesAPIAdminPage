import React, { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import Logo from "../assets/logo.png";
import GoogleSvg from "../assets/icons8-google.svg";
import "../styles/Register.css";

const Register = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const token = JSON.parse(localStorage.getItem("auth")) || "";

  useEffect(() => {
    if (token !== "") {
      toast.success("You are already logged in");
      navigate("/dashboard");
    }
  }, [token, navigate]);

  // -------------------------
  // Yup Validation Schema
  // -------------------------
  const validationSchema = Yup.object({
    name: Yup.string().required("Name is required"),
    lastname: Yup.string().required("Lastname is required"),

    username: Yup.string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .required("Username is required"),

    // FIXED STRICT EMAIL VALIDATION
    email: Yup.string()
      .trim()
      .matches(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid email format"
      )
      .required("Email is required"),

    mobileNumber: Yup.string()
      .trim()
      .min(10, "Mobile Number should be at least 10 digits")
      .required("Mobile Number is required"),

    dateOfBirth: Yup.date()
      .required("Date of Birth is required"),

    password: Yup.string()
      .min(6, "Password must be at least 6 characters")
      .required("Password is required"),

    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password"), null], "Passwords must match")
      .required("Confirm Password is required"),
  });

  // -------------------------
  // Formik Setup (FIXED)
  // -------------------------
  const formik = useFormik({
    initialValues: {
      name: "",
      lastname: "",
      username: "",
      email: "",
      mobileNumber: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
    },
    validationSchema,
    validateOnBlur: true,      // <<< FIX
    validateOnChange: true,    // <<< FIX
    onSubmit: async (values) => {
      const payload = {
        name: values.name + " " + values.lastname,
        username: values.username,
        email: values.email,
        mobileNumber: values.mobileNumber,
        dateOfBirth: values.dateOfBirth,
        password: values.password,
      };

      try {
        await axios.post("/api/v1/register", payload);
        toast.success("Registration successful!");
        navigate("/login");
      } catch (err) {
        const errorMsg = err?.response?.data?.msg || err.message;
        if (errorMsg === "Email already in use") {
          toast.error("Email already exists. Please Login.");
          // Optional: Redirect to login after a delay or let user click the link
        } else {
          toast.error(errorMsg);
        }
      }
    },
  });

  return (
    <div className="register-main">
      <div className="register-left">
        <div className="auth-illustration">
          <img src={Logo} alt="Logo" className="auth-logo-large" />
          <h1>Join Us Today</h1>
          <p>Create an account to start managing your team's attendance.</p>
        </div>
      </div>

      <div className="register-right">
        <div className="register-right-container">
          <div className="register-logo">
            <img src={Logo} alt="" />
          </div>

          <div className="register-center">
            <h2>Welcome!</h2>
            <p>Please enter your details</p>

            <form onSubmit={formik.handleSubmit}>

              {/* NAME */}
              <input
                type="text"
                name="name"
                placeholder="Name"
                className={formik.touched.name && formik.errors.name ? "input-error" : ""}
                {...formik.getFieldProps("name")}
              />
              {formik.touched.name && formik.errors.name && (
                <p className="error-text">{formik.errors.name}</p>
              )}

              {/* LASTNAME */}
              <input
                type="text"
                name="lastname"
                placeholder="Lastname"
                className={formik.touched.lastname && formik.errors.lastname ? "input-error" : ""}
                {...formik.getFieldProps("lastname")}
              />
              {formik.touched.lastname && formik.errors.lastname && (
                <p className="error-text">{formik.errors.lastname}</p>
              )}

              {/* USERNAME */}
              <input
                type="text"
                name="username"
                placeholder="Username (used for login)"
                className={formik.touched.username && formik.errors.username ? "input-error" : ""}
                {...formik.getFieldProps("username")}
              />
              {formik.touched.username && formik.errors.username && (
                <p className="error-text">{formik.errors.username}</p>
              )}

              {/* EMAIL (FIXED VALIDATION) */}
              <input
                type="email"
                name="email"
                placeholder="Email"
                className={formik.touched.email && formik.errors.email ? "input-error" : ""}
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="error-text">{formik.errors.email}</p>
              )}

              {/* MOBILE NUMBER */}
              <input
                type="text"
                name="mobileNumber"
                placeholder="Mobile Number"
                className={formik.touched.mobileNumber && formik.errors.mobileNumber ? "input-error" : ""}
                {...formik.getFieldProps("mobileNumber")}
              />
              {formik.touched.mobileNumber && formik.errors.mobileNumber && (
                <p className="error-text">{formik.errors.mobileNumber}</p>
              )}

              {/* DATE OF BIRTH */}
              <input
                type="date"
                name="dateOfBirth"
                placeholder="Date of Birth"
                title="Date of Birth"
                className={formik.touched.dateOfBirth && formik.errors.dateOfBirth ? "input-error" : ""}
                {...formik.getFieldProps("dateOfBirth")}
                style={{ 
                    // Make it look like the other inputs slightly better on some OS defaults
                    color: formik.values.dateOfBirth ? 'inherit' : '#9ca3af' 
                }}
              />
              {formik.touched.dateOfBirth && formik.errors.dateOfBirth && (
                <p className="error-text">{formik.errors.dateOfBirth}</p>
              )}

              {/* PASSWORD */}
              <div className="pass-input-div">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  className={
                    formik.touched.password && formik.errors.password ? "input-error" : ""
                  }
                  {...formik.getFieldProps("password")}
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

              {/* CONFIRM PASSWORD */}
              <div className="pass-input-div">
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  className={
                    formik.touched.confirmPassword && formik.errors.confirmPassword
                      ? "input-error"
                      : ""
                  }
                  {...formik.getFieldProps("confirmPassword")}
                />
                {showPassword ? (
                  <FaEyeSlash onClick={() => setShowPassword(!showPassword)} />
                ) : (
                  <FaEye onClick={() => setShowPassword(!showPassword)} />
                )}
              </div>

              {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                <p className="error-text">{formik.errors.confirmPassword}</p>
              )}

              {/* BUTTONS */}
              <div className="register-center-buttons">
                <button type="submit" disabled={formik.isSubmitting || !formik.isValid}>
                  {formik.isSubmitting ? "Creating account..." : "Sign Up"}
                </button>
              </div>
            </form>
          </div>

          <p className="login-bottom-p">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
