const {getIO} = require('../../connection/socket')
const axios = require('axios');
const Instance = require('../models/instanceModel')
const mongoose = require('mongoose');


const io = getIO();

exports.createQr = async (req, res) => {
  try {
      const url = process.env.LOGIN_CB_API
      const access_token = process.env.ACCESS_TOKEN_CB
      const createInstanceResponse = await axios.get(`${url}/create_instance`, {params:
      {access_token}
    })

    const instanceId = createInstanceResponse.data.instance_id;
    
    if (!instanceId) {
      throw new Error('Instance ID not found in the create instance response');
    }

    // Call the second API to get the QR Code, using the instanceId from the first call's response
    const getQrCodeResponse = await axios.get(`${url}/get_qrcode?instance_id=${instanceId}&access_token=${access_token}`);
    return res.status(200).json({
      message:'success',
      data: getQrCodeResponse.data,
      instance_id: instanceId
    })

    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

exports.setWebhook = async (req, res)=>{
  try {
    const url = process.env.LOGIN_CB_API;
    const instance_id = req.params.id;
    let enable = true;
    let webhook_url = process.env.WEBHOOK_API;
    const access_token = process.env.ACCESS_TOKEN_CB
    const result = await axios.get(`${url}/set_webhook`, {params:{
      webhook_url, enable, instance_id, access_token
    }})
    return res.status(200).json(result.data)
    
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

exports.createInstance = async (req, res)=>{
  try {
    const url = process.env.LOGIN_CB_API;
    const instance_id = req.body.instance_id;
    let enable = true;
    let webhook_url = process.env.WEBHOOK_API;
    const access_token = process.env.ACCESS_TOKEN_CB
    const result = await axios.get(`${url}/set_webhook`, {params:{
      webhook_url, enable, instance_id, access_token
    }})
    if(result.data.status!=='error'){
      req.body['lastScannedAt'] = new Date()
      req.body['isActive'] = true
    }else{
      req.body['isActive'] = false
    }
    req.body['access_token'] = access_token;
    const instance = new Instance(req.body);
    await instance.save();
    return res.status(201).send(instance);
  } catch (error) {
    console.log(error)
    return res.status(500).json({error: 'Internal Server Error'});
  }
};

exports.listAll = async (req, res)=>{
  try {
    const { page = 1, limit = 10 } = req.query;
    const startIndex = (page - 1) * limit;

    const items = await Instance.find().sort({createdAt: -1}).skip(startIndex).limit(limit);

    res.send({
      page,
      limit,
      data: items,
    });
  } catch (error) {
    console.log(error)
    return res.status(500).send(error);
  }
};
 

exports.getQr = async (req, res)=>{
  try {
    
    const url = process.env.LOGIN_CB_API
    const access_token = process.env.ACCESS_TOKEN_CB
    const { instanceId } = req.params;

    const getQrCodeResponse = await axios.get(`${url}/get_qrcode?instance_id=${instanceId}&access_token=${access_token}`);

    return res.status(200).json({
      message:'success',
      data: getQrCodeResponse.data,
      instance_id: instanceId
    })

  } catch (error) {
    console.log(error)
    return res.status(400).send(error);

  }
};

exports.updateInstance = async (req, res)=>{
  try {
    const { instanceId } = req.params;

    const url = process.env.LOGIN_CB_API;
    let enable = true;
    let webhook_url = process.env.WEBHOOK_API;
    const access_token = process.env.ACCESS_TOKEN_CB
    const result = await axios.get(`${url}/set_webhook`, {params:{
      webhook_url, enable, instance_id: instanceId, access_token
    }})
    if(result.data.status!=='error'){
      req.body['lastScannedAt'] = new Date()
      req.body['isActive'] = true
    }else{
      req.body['isActive'] = false
    }
    req.body['access_token'] = access_token;

    const item = await Instance.findByIdAndUpdate({instance_id: instanceId}, req.body, { new: true });

    if (!item) {
      return res.status(404).send({ message: 'Instance not found' });
    }

    return res.send(item);
  } catch (error) {
    console.log(error)
    return res.status(400).send(error);
  }
};

exports.deleteInstance = async (req, res)=>{
  const id = req.params.id;

  // Validate the ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    // Find the document by ID and delete it
    const deletedDoc = await Instance.findByIdAndDelete(id);

    // If the document does not exist
    if (!deletedDoc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Send a success response
    res.status(200).json({ message: 'Document deleted successfully', deletedDoc });
  } catch (error) {
    // Handle any errors
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}