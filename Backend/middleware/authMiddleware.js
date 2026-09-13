const { firebaseAuth, protect } = require('./firebaseAuthMiddleware');

module.exports = {
  firebaseAuth,
  protect
};

