const multer = require('multer');
const upload = multer({ dest: 'tmp/uploads/' });
module.exports = upload;
