// electron-store wrapper — replaces chrome.storage.sync / local / session
const Store = require('electron-store');

const store = new Store({ name: 'chrome-manual-maker' });

module.exports = {
  get(key, defaultVal) {
    return store.get(key, defaultVal);
  },
  set(key, value) {
    store.set(key, value);
  },
  delete(key) {
    store.delete(key);
  },
  has(key) {
    return store.has(key);
  },

  // Batch operations (mirrors chrome.storage.*.get(array) pattern)
  getMulti(keys) {
    const result = {};
    for (const k of keys) result[k] = store.get(k);
    return result;
  },
  setMulti(obj) {
    for (const [k, v] of Object.entries(obj)) store.set(k, v);
  },
  deleteMulti(keys) {
    for (const k of keys) store.delete(k);
  },
};
