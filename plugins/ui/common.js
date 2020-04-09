async function grab(include, req, res, next, data) {
  try {
    require(include)(req, res, next, data); // eslint-disable-line global-require,import/no-dynamic-require,max-len
    if (process.env.UI_DROP_CACHE === 'true') {
      Object.keys(require.cache).forEach((x) => {
        if (x.endsWith(include.replace(/\.\//g, ''))) {
          delete require.cache[x];
        }
      });
    }
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
    res.sendStatus(500);
  }
}
module.exports = {
  grab,
};
