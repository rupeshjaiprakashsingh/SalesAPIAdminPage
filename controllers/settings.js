const getSettings = async (req, res) => {
  try {
    const Settings = req.models.Settings;
    const { type } = req.params;
    let setting = await Settings.findOne({ type });
    
    if (!setting) {
        // default initialization
        setting = await Settings.create({ type, data: [] });
    }
    
    res.status(200).json({ setting });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const Settings = req.models.Settings;
    const { type } = req.params;
    const { data } = req.body; // array of strings
    
    let setting = await Settings.findOne({ type });
    if (!setting) {
        setting = await Settings.create({ type, data });
    } else {
        setting.data = data;
        await setting.save();
    }
    
    res.status(200).json({ setting });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
