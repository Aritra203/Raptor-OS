// Filesystem compatibility shim for Windows environments running on exFAT / FAT32 volumes
// where libuv returns EISDIR instead of POSIX EINVAL when readlink is called on non-symlinks.
try {
  require("dotenv").config();
  if (process.argv.includes("build")) {
    process.env.NODE_ENV = "production";
  }
} catch {}
const fs = require("fs");

if (process.platform !== "win32") {
  return;
}

function fixError(err) {
  if (err && err.code === "EISDIR") {
    err.code = "EINVAL";
  }
  return err;
}

const origReadlink = fs.readlink;
fs.readlink = function (path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return origReadlink.call(fs, path, options, (err, linkString) => {
    if (err) fixError(err);
    if (callback) callback(err, linkString);
  });
};

const origReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function (path, options) {
  try {
    return origReadlinkSync.call(fs, path, options);
  } catch (err) {
    throw fixError(err);
  }
};

if (fs.promises && fs.promises.readlink) {
  const origPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = async function (path, options) {
    try {
      return await origPromisesReadlink.call(fs.promises, path, options);
    } catch (err) {
      throw fixError(err);
    }
  };
}

// Handle ExFAT ghost directories that throw EPERM on scandir/readdir
const isGhostSlug = (p) => typeof p === "string" && (p.includes("[slug]") || p.includes("shared"));

const origReaddirSync = fs.readdirSync;
fs.readdirSync = function (path, options) {
  try {
    return origReaddirSync.call(fs, path, options);
  } catch (err) {
    if (err && err.code === "EPERM" && isGhostSlug(path)) {
      return [];
    }
    throw err;
  }
};

const origReaddir = fs.readdir;
fs.readdir = function (path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return origReaddir.call(fs, path, options, (err, files) => {
    if (err && err.code === "EPERM" && isGhostSlug(path)) {
      return callback ? callback(null, []) : undefined;
    }
    if (callback) callback(err, files);
  });
};

if (fs.promises && fs.promises.readdir) {
  const origPromisesReaddir = fs.promises.readdir;
  fs.promises.readdir = async function (path, options) {
    try {
      return await origPromisesReaddir.call(fs.promises, path, options);
    } catch (err) {
      if (err && err.code === "EPERM" && isGhostSlug(path)) {
        return [];
      }
      throw err;
    }
  };
}
