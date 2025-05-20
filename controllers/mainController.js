const path = require('path');

exports.handle = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, '../views/main.html'));
};
