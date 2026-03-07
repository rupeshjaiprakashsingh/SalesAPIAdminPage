import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/Reports.css"; // Reusing report styles for table layout

export default function Enquiries() {
    const [enquiries, setEnquiries] = useState([]);
    const [loading, setLoading] = useState(true);

    const token = JSON.parse(localStorage.getItem("auth")) || localStorage.getItem("token") || "";

    useEffect(() => {
        fetchEnquiries();
    }, []);

    const fetchEnquiries = async () => {
        try {
            const res = await axios.get("/api/v1/enquiry/all", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setEnquiries(res.data.data);
            }
        } catch (err) {
            console.error("Error fetching enquiries:", err);
            toast.error("Failed to load enquiries");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reports-page">
            <div className="reports-header">
                <h1>📨 Enquiries</h1>
                <p>View all contact form submissions</p>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>Recent Enquiries</h3>
                </div>
                <div className="card-body">
                    {loading ? (
                        <p>Loading enquiries...</p>
                    ) : enquiries.length === 0 ? (
                        <p>No enquiries found.</p>
                    ) : (
                        <div className="table-container">
                            <table className="table-responsive">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Mobile</th>
                                        <th>Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enquiries.map((enquiry) => (
                                        <tr key={enquiry._id}>
                                            <td>
                                                {new Date(enquiry.createdAt).toLocaleDateString("en-US", {
                                                    year: "numeric",
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>
                                            <td>{enquiry.fullName}</td>
                                            <td>{enquiry.email}</td>
                                            <td>{enquiry.mobileNumber}</td>
                                            <td style={{ maxWidth: "300px", whiteSpace: "normal" }}>
                                                {enquiry.message}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
