const currentExports = {
    ...require('./client'),
    ...require('./endpoints'),
    ...require('./errors'),
    ...require('./events'),
    ...require('./gateway'),
    ...require('./logger'),
    ...require('./models'),
    ...require('./presence'),
    ...require('./rest'),
    ...require('./snowflake'),
    ...require('./utils'),
};

module.exports = {...currentExports};