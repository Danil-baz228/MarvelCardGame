const fs = require('fs');
const path = require('path');

exports.handle = async (req, res) => {
  const filePath = path.resolve('views', 'main.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return res.status(500).send('Template error');

    const user = req.session.user
        ? JSON.stringify(req.session.user)
        : 'null';

    const finalHtml = html.replace(
        '<!-- {{USER_INJECT}} -->',
        `<script>window.user = ${user};</script>`
    );

    res.send(finalHtml);
  });
};
