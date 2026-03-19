import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/CustomersDashboard.css";

const CustomersDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("Dashboard");
    const tabs = ["Dashboard", "Customers List", "Customers Settings", "How To Use"];
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchCustomers = async () => {
        setLoading(true);
        const authItem = localStorage.getItem("auth");
        let token = null;
        if (authItem) {
            try {
                token = authItem.startsWith("{") ? JSON.parse(authItem).token : JSON.parse(authItem);
            } catch (err) {}
        }

        try {
            const res = await axios.get("/api/v1/customers", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setCustomers(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCustomer = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete customer '${name}'?`)) return;

        const authItem = localStorage.getItem("auth");
        let token = null;
        if (authItem) {
            try { token = authItem.startsWith("{") ? JSON.parse(authItem).token : JSON.parse(authItem); } catch (err) {}
        }
        
        try {
            const res = await axios.delete(`/api/v1/customers/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                fetchCustomers(); // Refresh the list
            }
        } catch (error) {
            console.error("Error deleting customer:", error);
            alert("Failed to delete customer");
        }
    };

    useEffect(() => {
        if (activeTab === "Customers List") {
            fetchCustomers();
        }
    }, [activeTab]);

    const renderDashboard = () => (
        <div className="cust-content">
            <div className="cust-header">
                <h2>Customers Dashboard</h2>
            </div>
            
            <div className="cust-metrics-grid">
                <div className="cust-metric-card pink">
                    <div className="cust-metric-header">
                        <span>Serving Today</span>
                        <i className="ri-list-check" style={{ color: '#d946ef' }}></i>
                    </div>
                    <div className="cust-metric-value">0</div>
                </div>
                <div className="cust-metric-card purple">
                    <div className="cust-metric-header">
                        <span>Not yet Started</span>
                        <i className="ri-play-circle-line" style={{ color: '#8b5cf6' }}></i>
                    </div>
                    <div className="cust-metric-value">0</div>
                </div>
                <div className="cust-metric-card yellow">
                    <div className="cust-metric-header">
                        <span>Delayed Tasks</span>
                        <i className="ri-time-line" style={{ color: '#eab308' }}></i>
                    </div>
                    <div className="cust-metric-value">0</div>
                </div>
                <div className="cust-metric-card blue">
                    <div className="cust-metric-header">
                        <span>In progress</span>
                        <i className="ri-loader-4-line" style={{ color: '#3b82f6' }}></i>
                    </div>
                    <div className="cust-metric-value">0</div>
                </div>
                <div className="cust-metric-card green">
                    <div className="cust-metric-header">
                        <span>Completed Tasks</span>
                        <i className="ri-checkbox-circle-line" style={{ color: '#10b981' }}></i>
                    </div>
                    <div className="cust-metric-value">0</div>
                </div>
            </div>

            <div className="cust-chart-section">
                <div className="cust-section-header">
                    <div className="cust-section-title">
                        <h3>Customers Overview</h3>
                        <p>Number of Customers Added per Day</p>
                    </div>
                    <div className="cust-filters">
                        <div className="cust-filter-select">Customers A... <i className="ri-arrow-down-s-line"></i></div>
                        <div className="cust-filter-select">Last 7 days <i className="ri-arrow-down-s-line"></i></div>
                        <div className="cust-filter-select">11 Mar '26 - 17 Mar '26 <i className="ri-calendar-line"></i></div>
                    </div>
                </div>
                
                <div style={{ marginTop: '40px' }}>
                    <div className="cust-chart-area">
                        <div className="cust-y-axis">
                            <span>3</span><span>2.25</span><span>1.5</span><span>0.75</span><span>0</span>
                        </div>
                        <div className="cust-chart-bar" style={{height: '100%'}}><span>11 Mar</span></div>
                        <div className="cust-chart-bar" style={{height: '66%'}}><span>12 Mar</span></div>
                        <div className="cust-chart-bar" style={{height: '33%'}}><span>13 Mar</span></div>
                        <div className="cust-chart-bar" style={{height: '0%', background: 'transparent'}}><span>14 Mar</span></div>
                        <div className="cust-chart-bar" style={{height: '0%', background: 'transparent'}}><span>15 Mar</span></div>
                        <div className="cust-chart-bar" style={{height: '33%'}}><span>16 Mar</span></div>
                        <div className="cust-chart-bar" style={{height: '33%'}}><span>17 Mar</span></div>
                    </div>
                </div>
            </div>

            <div className="cust-chart-section">
                <div className="cust-section-header">
                    <div className="cust-section-title">
                        <h3>Top Customers Served</h3>
                        <p>See the number of tasks performed against customers</p>
                    </div>
                    <div className="cust-filters">
                        <div className="cust-filter-select">Last 7 days <i className="ri-arrow-down-s-line"></i></div>
                        <div className="cust-filter-select">11 Mar '26 - 17 Mar '26 <i className="ri-calendar-line"></i></div>
                    </div>
                </div>
                <div className="cust-empty-state">
                    <i className="ri-file-search-line cust-empty-icon"></i>
                    <p>No data to show</p>
                </div>
            </div>

            <div className="cust-chart-section">
                <div className="cust-section-header">
                    <div className="cust-section-title">
                        <h3>Customers Served Summary</h3>
                        <p>See the details of customers served in a time frame along with task metrics</p>
                    </div>
                </div>
                <div className="cust-empty-state">
                    <i className="ri-survey-line cust-empty-icon" style={{color: '#3b82f6'}}></i>
                    <p>No summary data available</p>
                </div>
            </div>
        </div>
    );

    const renderCustomersList = () => {
        const filteredCustomers = customers.filter(c => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (c.number && c.number.includes(searchQuery))
        );

        return (
            <div className="cust-content" style={{ background: '#ffffff', minHeight: 'calc(100vh - 80px)', margin: '20px', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>Customers</h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>Access your customer details, or add more from this page.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            onClick={() => navigate("/dashboard/customers/add")}
                            style={{ background: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <i className="ri-add-line"></i> Add Customer <i className="ri-arrow-down-s-line"></i>
                        </button>
                        <button style={{ background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}>
                            Customers Template
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', width: '300px' }}>
                            <i className="ri-search-line" style={{ color: '#9ca3af', marginRight: '8px' }}></i>
                            <input 
                                type="text" 
                                placeholder="Search by customer name or phone" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.85rem' }} 
                            />
                        </div>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                            <i className="ri-filter-3-fill"></i> Filter
                        </button>
                    </div>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
                        <i className="ri-download-line"></i> Download
                    </button>
                </div>

                {loading ? (
                     <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading Customers...</div>
                ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', borderBottom: 'none' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', background: '#f9fafb' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Customer Name</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Customer Number</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Address</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Email ID</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>City</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Pincode</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Land Mark</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Added by</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Added On</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Visible to</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map(c => {
                                    const truncAddress = c.address ? (c.address.length > 20 ? c.address.substring(0,20)+'...' : c.address) : '-';
                                    const truncEmail = c.email ? (c.email.length > 20 ? c.email.substring(0,20)+'...' : c.email) : '-';
                                    const creatorName = c.createdBy ? c.createdBy.name : 'Unknown';
                                    const dateStr = new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                    
                                    return (
                                        <tr key={c._id} style={{ borderBottom: '1px solid #e5e7eb', color: '#111827' }}>
                                            <td style={{ padding: '16px', fontWeight: 500, color: '#3b82f6', cursor: 'pointer' }}>{c.name}</td>
                                            <td style={{ padding: '16px' }}>{c.number}</td>
                                            <td style={{ padding: '16px', color: '#3b82f6', cursor: 'pointer' }} title={c.address}>{truncAddress}</td>
                                            <td style={{ padding: '16px' }} title={c.email}>{truncEmail}</td>
                                            <td style={{ padding: '16px' }}>{c.city || '-'}</td>
                                            <td style={{ padding: '16px' }}>{c.postalCode || '-'}</td>
                                            <td style={{ padding: '16px' }}>{c.landmark || '-'}</td>
                                            <td style={{ padding: '16px', color: '#4b5563', textTransform: 'uppercase', fontSize: '0.8rem' }}>{creatorName}</td>
                                            <td style={{ padding: '16px' }}>{dateStr}</td>
                                            <td style={{ padding: '16px' }}>{c.visibleTo === 'All Staff' ? 'All' : creatorName}</td>
                                            <td style={{ padding: '16px', color: '#3b82f6' }}>
                                                <i 
                                                    className="ri-pencil-fill" 
                                                    style={{ marginRight: '16px', cursor: 'pointer' }}
                                                    onClick={() => navigate(`/dashboard/customers/${c._id}/edit`)}
                                                ></i>
                                                <i 
                                                    className="ri-delete-bin-fill" 
                                                    style={{ color: '#ef4444', cursor: 'pointer' }}
                                                    onClick={() => handleDeleteCustomer(c._id, c.name)}
                                                ></i>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredCustomers.length === 0 && (
                                    <tr>
                                        <td colSpan="11" style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>No customers found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="cust-dashboard-layout">
            <div className="cust-tabs">
                {tabs.map(tab => (
                    <button 
                        key={tab} 
                        className={`cust-tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1 }}>
                {activeTab === "Dashboard" && renderDashboard()}
                {activeTab === "Customers List" && renderCustomersList()}
                
                {(activeTab !== "Dashboard" && activeTab !== "Customers List") && (
                    <div style={{ padding: '80px 20px', textAlign: 'center', color: '#6b7280' }}>
                        <i className="ri-tools-line" style={{ fontSize: '3rem', margin: '0 0 16px 0', display: 'inline-block', color: '#9ca3af' }}></i>
                        <h3 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '1.5rem' }}>{activeTab} module</h3>
                        <p style={{ margin: 0 }}>This section layout is reserved for future implementation.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomersDashboard;
