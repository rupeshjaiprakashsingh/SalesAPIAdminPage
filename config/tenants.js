const tenants = {
  scan_services: {
    name: "Scan Services",
    uri: process.env.SCAN_SERVICE_MONGO_URI,
  },
  ezzy_products: {
    name: "Ezzy Products",
    uri: process.env.EZZY_PRODUCT_MONGO_URI,
  },
};

module.exports = tenants;
