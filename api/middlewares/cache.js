const NodeCache = require( "node-cache" );
const myCache = new NodeCache();
const SetModel = require('../models/setModel')

async function getCachedData(key) {
    const value = myCache.get(key);
    if (value) {
      console.log("Data retrieved from cache");
      return value;
    }

    const data =  await fetchFunction(key);
  
    console.log("Data stored in cache");
    return data;
  }

  async function fetchFunction(key){
    const data = await SetModel.findOne({status:'active'}).lean().exec()
    myCache.set(key, data);
    return data
  }
  
  function clearCache(key) {
    if (myCache.has(key)) {
      myCache.del(key);
      console.log(`Data with key '${key}' cleared from cache`);
      return true;
    } else {
      console.log(`No data found with key '${key}' in cache`);
      return false;
    }
  }

  module.exports = {
    getCachedData,
    fetchFunction,
    clearCache
  };