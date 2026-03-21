import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import "../styles/AddCustomer.css";

const mapContainerStyle = { width: "100%", height: "100%", borderRadius: "8px" };
const defaultCenter = { lat: 26.8467, lng: 80.9462 }; // Focus around Lucknow based on screenshot

const AddCustomer = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);
    
    // Map setup
    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    const [mapInstance, setMapInstance] = useState(null);
    const [markerPos, setMarkerPos] = useState(defaultCenter);

    // Form setup
    const [formData, setFormData] = useState({
        name: "",
        number: "",
        email: "",
        landmark: "",
        address: "",
        city: "",
        postalCode: "",
        visibleTo: "All Staff",
        permissions: {
            editEmail: false,
            editNumber: false,
            editAddress: false
        }
    });

    const onLoad = useCallback(function callback(map) {
        setMapInstance(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMapInstance(null);
    }, []);

    useEffect(() => {
        if (isEditMode) {
            const fetchCustomerData = async () => {
                const authItem = localStorage.getItem("auth");
                let token = null;
                if (authItem) {
                    try { token = authItem.startsWith("{") ? JSON.parse(authItem).token : JSON.parse(authItem); } catch (err) {}
                }
                
                try {
                    const res = await axios.get(`/api/v1/customers/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data.success) {
                        const data = res.data.data;
                        setFormData({
                            name: data.name || "",
                            number: data.number || "",
                            email: data.email || "",
                            landmark: data.landmark || "",
                            address: data.address || "",
                            city: data.city || "",
                            postalCode: data.postalCode || "",
                            visibleTo: data.visibleTo || "All Staff",
                            permissions: data.permissions || {
                                editEmail: false,
                                editNumber: false,
                                editAddress: false
                            }
                        });
                        if (data.location && data.location.lat && data.location.lng) {
                            setMarkerPos({ lat: data.location.lat, lng: data.location.lng });
                        }
                    }
                } catch (error) {
                    console.error("Error fetching customer:", error);
                    toast.error("Failed to fetch customer data");
                }
            };
            fetchCustomerData();
        }
    }, [id, isEditMode]);

    const handleMapClick = (e) => {
        setMarkerPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleToggle = (permissionName) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [permissionName]: !prev.permissions[permissionName]
            }
        }));
    };

    const handleSave = async () => {
        if(!formData.name || !formData.number || !formData.address) {
            toast.error("Please fill required fields (Name, Number, Address).");
            return;
        }

        const authItem = localStorage.getItem("auth");
        let token = null;
        if (authItem) {
            try {
                token = authItem.startsWith("{") ? JSON.parse(authItem).token : JSON.parse(authItem);
            } catch (err) {}
        }

        if (!token) {
            toast.error("Authentication required");
            return;
        }

        const payload = {
            ...formData,
            location: markerPos
        };

        try {
            if (isEditMode) {
                const res = await axios.put(`/api/v1/customers/${id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    toast.success("Customer updated successfully!");
                    navigate("/dashboard/customers");
                }
            } else {
                const res = await axios.post("/api/v1/customers", payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    toast.success("Customer added successfully!");
                    navigate("/dashboard/customers");
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} customer`);
        }
    };

    return (
        <div className="add-cust-container">
            <div className="add-cust-header">
                <button className="add-cust-back" onClick={() => navigate("/dashboard/customers")}>
                    <i className="ri-arrow-left-line"></i> Back
                </button>
                <h2>{isEditMode ? "Edit customer" : "Add Customer"}</h2>
                <p>{isEditMode ? "Edit customer details" : "Add customers to Geo, against which tasks can be assigned to your staff."}</p>
            </div>

            <div className="add-cust-card">
                <div className="add-cust-grid">
                    
                    {/* Left Column (Inputs & Toggles) */}
                    <div>
                        <div className="add-cust-form-group">
                            <label className="add-cust-label">Customer Name <span>*</span></label>
                            <input 
                                type="text" 
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="add-cust-input" 
                                placeholder="Enter customer name"
                            />
                        </div>

                        <div className="add-cust-form-group">
                            <label className="add-cust-label">Customer Number <span>*</span></label>
                            <input 
                                type="text" 
                                name="number"
                                value={formData.number}
                                onChange={handleChange}
                                className="add-cust-input" 
                                placeholder="Enter phone number" 
                            />
                        </div>

                        <div className="add-cust-form-group">
                            <label className="add-cust-label">Email ID</label>
                            <div className="add-cust-email-container">
                                <input 
                                    type="email" 
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="add-cust-email-input" 
                                    placeholder="Enter email address" 
                                />
                            </div>
                        </div>

                        <div className="add-cust-form-group">
                            <label className="add-cust-label">Land Mark</label>
                            <input 
                                type="text" 
                                name="landmark"
                                value={formData.landmark}
                                onChange={handleChange}
                                className="add-cust-input" 
                                placeholder="Enter land mark" 
                            />
                        </div>

                        <div className="add-cust-permissions-section">
                            <div className="add-cust-permissions-title">Permission for employee to edit</div>
                            
                            <div className="add-cust-permission-item">
                                <span className="add-cust-permission-label">Customer Email Address</span>
                                <label className="cust-toggle-switch">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.permissions.editEmail}
                                        onChange={() => handleToggle('editEmail')}
                                    />
                                    <span className="cust-toggle-slider"></span>
                                </label>
                            </div>
                            
                            <div className="add-cust-permission-item">
                                <span className="add-cust-permission-label">Customer contact number</span>
                                <label className="cust-toggle-switch">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.permissions.editNumber}
                                        onChange={() => handleToggle('editNumber')}
                                    />
                                    <span className="cust-toggle-slider"></span>
                                </label>
                            </div>

                            <div className="add-cust-permission-item">
                                <span className="add-cust-permission-label">Customer Address</span>
                                <label className="cust-toggle-switch">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.permissions.editAddress}
                                        onChange={() => handleToggle('editAddress')}
                                    />
                                    <span className="cust-toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div className="add-cust-form-group" style={{ marginTop: '24px' }}>
                            <label className="add-cust-label">Visible to</label>
                            <div className="add-cust-select-wrapper">
                                <select 
                                    name="visibleTo"
                                    value={formData.visibleTo}
                                    onChange={handleChange}
                                    className="add-cust-select"
                                >
                                    <option value="All Staff">All Staff</option>
                                    <option value="Admin Only">Admin Only</option>
                                </select>
                                <i className="ri-arrow-down-s-line add-cust-select-icon"></i>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Address & Map) */}
                    <div>
                        <div className="add-cust-form-group">
                            <label className="add-cust-label">Address <span>*</span></label>
                            <input 
                                type="text" 
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="add-cust-input" 
                                placeholder="Enter full address" 
                            />
                        </div>

                        <div className="add-cust-address-row">
                            <div className="add-cust-form-group" style={{ marginBottom: 0 }}>
                                <label className="add-cust-label">City</label>
                                <input 
                                    type="text" 
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="add-cust-input" 
                                    placeholder="Enter city" 
                                />
                            </div>
                            <div className="add-cust-form-group" style={{ marginBottom: 0 }}>
                                <label className="add-cust-label">Postal Code</label>
                                <input 
                                    type="text" 
                                    name="postalCode"
                                    value={formData.postalCode}
                                    onChange={handleChange}
                                    className="add-cust-input" 
                                    placeholder="Enter postal code" 
                                />
                            </div>
                        </div>

                        <div className="add-cust-map-container">
                            {isLoaded ? (
                                <GoogleMap
                                    mapContainerStyle={mapContainerStyle}
                                    center={defaultCenter}
                                    zoom={14}
                                    onLoad={onLoad}
                                    onUnmount={onUnmount}
                                    onClick={handleMapClick}
                                >
                                    <Marker 
                                        position={markerPos} 
                                        icon={{
                                            path: window.google ? window.google.maps.SymbolPath.CIRCLE : 0,
                                            scale: 12,
                                            fillColor: '#ef4444',
                                            fillOpacity: 1,
                                            strokeColor: '#ffffff',
                                            strokeWeight: 2,
                                        }}
                                    />
                                </GoogleMap>
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>Loading map...</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="add-cust-actions">
                    <button className="btn-cust-cancel" onClick={() => navigate("/dashboard/customers")}>Cancel</button>
                    <button className="btn-cust-save" onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
};

export default AddCustomer;
