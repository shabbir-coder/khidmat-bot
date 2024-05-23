const {getIO} = require('../../connection/socket')
const axios = require('axios');
const Instance = require('../models/instanceModel')
const {Message, Contact, ChatLogs} = require('../models/chatModel');
const User = require('../models/user');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs')
const { getCachedData } = require('../middlewares/cache');
const moment = require('moment-timezone');
const handlebars = require('handlebars');
const PDFDocument = require('pdfkit');
const csv = require('csvtojson');
const dataKey = 'activeSet';
const xlsx = require('xlsx');
const pdf = require('html-pdf');


const saveContact = async(req, res)=>{
    try {
      const {name , ITS, number} = req.body
      const existingContact = await Contact.findOne({
        $or: [
          { name },
          { ITS }
          ]
        });
  
        if (existingContact) {
          let errorMessage = 'Contact already exists with the same ';
          const errors = [];
          if (existingContact.name === name) errors.push('name');
          if (existingContact.ITS === ITS) errors.push('ITS');
          if (existingContact.number === number) errors.push('number');

          errorMessage += errors.join(' or ') + '.';

          return res.status(400).send({ error: errorMessage });
        } 
        const contact = new Contact(req.body);
        await contact.save();
        return res.status(201).send(contact);
      } catch (error) {
        // console.log(error)
        return res.status(500).send({ error: error.message });
      }
}

const getContact = async(req, res)=>{
    try {
      let query = {};
      const { page, limit, searchtext} = req.query;
      if (searchtext) {
        query = {
          $or: [
            { name: { $regex: new RegExp(searchtext, 'i') } },
            { ITS: { $regex: new RegExp(searchtext, 'i') } },
            { number: { $regex: new RegExp(searchtext, 'i') } }
          ]
        };
      }
      // console.log('query', query)
      const Contacts = await Contact.find(query)
        .skip((page - 1) * limit)
        .limit(limit);
      const count = await Contact.countDocuments(query)

      return res.status(200).json({data: Contacts, total: count});

      } catch (error) {
        // console.log(error)
        return res.status(500).send({ error: error.message });
      }
}

const updateContacts = async(req, res)=>{
    try {
        const { id } = req.params;
        const contact = await Contact.findByIdAndUpdate(id, req.body, { new: true });
        if (!contact) {
          return res.status(404).send({ message: 'Contact not found' });
        }
        res.status(200).send(contact);
      } catch (error) {
        // console.log(error)
        return res.status(500).send({ error: error.message });
      }
}

const getMessages = async (req, res)=>{
    try {
        const { recieverId, instance_id} = req.body;
        const senderId = req.user.userId;
        const messages = await Message.find({ 
          $or: [
            { recieverId, senderId}, // Both ids are the same
            { recieverId: senderId, senderId: recieverId },
            { senderId: recieverId, instance_id },
            { recieverId, instance_id } // Ids are reversed
          ]
         }).sort({ createdAt: 1 });
        res.status(200).send(messages);
      } catch (error) {
        // console.log(error)
        return res.status(500).send({ error: error.message });
      }
}

const sendMessages = async (req, res)=>{
  try {
    const io = getIO();

    const { recieverId, recieverNumber, type , text, instance_id } = req.body;

    const senderId = req.user.userId
    // Save the message to the database
    const newMessage = new Message({ senderId, instance_id,  recieverId, text, type });
    await newMessage.save();

    const url = process.env.LOGIN_CB_API
    const access_token = process.env.ACCESS_TOKEN_CB
    const params = {
      number: recieverNumber,
      type,
      message: text
    };

    const response = await axios.get(`${url}/send`,{params:{...params, instance_id, access_token}})

    // console.log('response', response.data)
    
    // Emit the message to all clients in the conversation room
    io.emit(instance_id.toString() , newMessage);

    return res.status(201).send(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.data });
  }
}

const recieveMessages = async (req, res)=>{
  try {
    // const io = getIO();
    const activeSet = await getCachedData(dataKey)
    const messageObject = req.body;
    const venueNames = ['Saifee Masjid','Burhani Masjid','MM Warqa']
    const khidmatNames = ['For all Majlis and Miqaat','Only During Ramadan','Only During Ashara','Only During Ramadan and Ashara']
    if(messageObject.data?.data?.messages?.[0]?.key?.fromMe === true) return res.send()
    if(["messages.upsert"].includes(req.body?.data?.event)){
      // console.log(messageObject.data.data.messages?.[0]?.message)
      let message;
      const currentTime = moment();
      const startingTime = moment(activeSet?.StartingTime);
      const endingTime = moment(activeSet?.EndingTime);

      message = messageObject.data.data.messages?.[0]?.message?.extendedTextMessage?.text || messageObject.data.data.messages?.[0]?.message?.conversation || '';
      let remoteId = messageObject.data.data.messages?.[0]?.key.remoteJid.split('@')[0];
      const senderId = await Contact.findOne({number: remoteId})
      
      const recieverId = await Instance.findOne({instance_id: messageObject.instance_id})
      const newMessage = {
        recieverId : recieverId?._id,
        senderId: senderId?._id,
        instance_id: messageObject?.instance_id,
        text: message,
        type: 'text'
      }
      const savedMessage = new Message(newMessage);
      await savedMessage.save();
      const sendMessageObj={
        number: remoteId,
        type: 'text',
        instance_id: messageObject?.instance_id,
      }
      
      if (!currentTime.isBetween(startingTime, endingTime)) {
        const response =  await sendMessageFunc({...sendMessageObj,message: "Registrations are closed now" });
        return res.send(true);      
      }
    
      let start = new Date();
      start.setHours(0,0,0,0);

      let end = new Date();
      end.setHours(23,59,59,999);

      if(['report','reports'].includes(message.toLowerCase()) && senderId?.isAdmin){
        if(!senderId?.isAdmin){
          const response =  await sendMessageFunc({...sendMessageObj, message: 'Invalid Input' });
          return res.send(true);
        }
        const fileName = await getReportdataByTime(start,end, messageObject?.instance_id)
        // const fileName = 'http://5.189.156.200:84/uploads/reports/Report-1716394369435.csv'
        sendMessageObj.filename = fileName.split('/').pop();
        sendMessageObj.media_url= process.env.IMAGE_URL+fileName;
        sendMessageObj.type = 'media';
        const response =  await sendMessageFunc({...sendMessageObj, message:'Download report'});
        return res.send(true);
      }

      if(['stats','statitics'].includes(message.toLowerCase()) && senderId?.isAdmin){
        if(!senderId?.isAdmin){
          const response =  await sendMessageFunc({...sendMessageObj, message: 'Invalid Input' });
          return res.send(true);
        }

        const replyObj = await getStats1(messageObject?.instance_id,'','');
        const formattedStart = moment(activeSet?.StartingTime).format('DD-MM-YYYY');
        const formattedEnd = moment(activeSet?.EndingTime).format('DD-MM-YYYY');

        let replyMessage = '*Statistics*';
        replyMessage += '\n\n';
        replyMessage += `\n● Start of Campaign *${formattedStart}*`;
        replyMessage += `\n● End of Campaign *${formattedEnd}*`;
        replyMessage += `\n● Total nos of entries *${replyObj?.totalEntries}*`;
        replyMessage += `\n● Total nos updated responses *${replyObj?.totalCompletedResponses}*`;
        replyMessage += `\n● Total nos of incomplete responses *${replyObj?.totalIncompleteResponses}*`;
        replyMessage += `\n● Total nos of unresponsive *${replyObj?.totalUnresponsiveContacts}*`;
        
        const response = await sendMessageFunc({...sendMessageObj, message: replyMessage});
        return res.send(true);
      }
      
      if(!senderId) {
        if(message.toLowerCase() === activeSet?.EntryPoint.toLowerCase()){
          const response =  await sendMessageFunc({...sendMessageObj,message: 'Whatsapp Number not found on Anjuman Najmi Profile'});
          return res.send({message:'Account not found'});
        } else {
          return res.send({message:'Account not found'});
        }
      }

      if(message.toLowerCase() === activeSet?.EntryPoint.toLowerCase()){
        const response =  await sendMessageFunc({...sendMessageObj,message: activeSet.NumberVerifiedMessage });
        senderId.isVerified = true
        await senderId.save()
        return res.send(true)

      } else if ( senderId?.isVerified && /^\d{8}$/.test(message)){
        const ITSmatched = await Contact.findOne({number: remoteId, ITS:message})
        let responseText= '';
        const NewChatLog = await ChatLogs.findOneAndUpdate(
          {
            senderId: senderId?._id,
            instance_id: messageObject?.instance_id,
            requestedITS: message, // Ensure there is a registeredId
            updatedAt: { $gte: start, $lt: end } // Documents updated today
          },
          {
            $set: {
              updatedAt: Date.now(),
              isValid: ITSmatched? true: false
            }
          },
          {
            upsert: true, // Create if not found, update if found
            new: true // Return the modified document rather than the original
          }
        )
        if(ITSmatched){
           
            const izanDate = new Date(ITSmatched.lastIzantaken)
            console.log(izanDate >= start && izanDate <= end,{izanDate}, {start} , {end})
            if( izanDate >= start && izanDate <= end){
              console.log('saving from here')
              const response = await sendMessageFunc({...sendMessageObj,message:'Already registered. Type Change to edit the selected choice.' });
              return res.send(true)
            }
      
          responseText = activeSet.ITSverificationMessage.replace('${name}', ITSmatched.name );
            const chatLog = await ChatLogs.findOne(
              {
                  senderId: senderId?._id,
                  instance_id: messageObject?.instance_id,
                  updatedAt: { $gte: start, $lt: end }
              }
            ).sort({ updatedAt: -1 });

            chatLog.updatedAt = Date.now();
            chatLog.messageTrack = 'venue';
            await chatLog.save();
        } else {
          responseText = activeSet.ITSverificationFailed;
        }
        const response = await sendMessageFunc({...sendMessageObj,message: responseText});
        return res.send(true);

      } else if (senderId.isVerified && /^\d{4,7}$/.test(message)){
        const response =  await sendMessageFunc({...sendMessageObj,message: 'Incorrect ITS, Please enter valid ITS only' });
        return res.send(true)
      } else if (senderId.isVerified && /^\d{2,3}$/.test(message)){
        const response =  await sendMessageFunc({...sendMessageObj,message: 'Incorrect ITS, Please enter valid ITS only' });
        return res.send(true)
      } else if (senderId.isVerified && (message.match(/\n/g) || []).length !== 0){
        const response =  await sendMessageFunc({...sendMessageObj,message: 'Invalid Input' });
        return res.send(true)
      } else {
        if(!senderId.isVerified) return res.send(true);
        const latestChatLog = await ChatLogs.findOne(
          {
              senderId: senderId?._id,
              instance_id: messageObject?.instance_id,
              updatedAt: { $gte: start, $lt: end }
          }
        ).sort({ updatedAt: -1 });

        if(!latestChatLog?.isValid){
          const response =  await sendMessageFunc({...sendMessageObj,message: 'Please enter valid ITS first' });
          return res.send(true);
        }

        const messages = Object.values(latestChatLog?.otherMessages || {});
        const requestedITS = await Contact.findOne({number: remoteId, ITS: latestChatLog?.requestedITS})
          
        const izanDate = new Date(requestedITS?.lastIzantaken)

        if( izanDate >= start && izanDate <= end && !['cancel','change'].includes(message.toLowerCase())){
          if((latestChatLog.messageTrack === 'venue' && (isNaN(message) || +message > venueNames.length)) ||
          (latestChatLog.messageTrack === 'profile' && (isNaN(message) || +message > khidmatNames.length))){
            const response = await sendMessageFunc({...sendMessageObj,message:'Invalid Input' });
            return res.send(true)    
          }
          const response = await sendMessageFunc({...sendMessageObj,message:'Already registered. Type Change to edit the selected choice.' });
          return res.send(true)
        }
        if(['cancel','change'].includes(message.toLowerCase())){

          const latestChatLog = await ChatLogs.findOne(
            {
                senderId: senderId?._id,
                instance_id: messageObject?.instance_id,
                updatedAt: { $gte: start, $lt: end }
            }
          ).sort({ updatedAt: -1 });
          // let lastKeyToDelete = null;
          if(!latestChatLog){
            const response =  await sendMessageFunc({...sendMessageObj,message: 'Nothing to cancel' });
            return res.send(true);
          }
          // for (const [key, value] of Object.entries(latestChatLog?.otherMessages)) {
          //   if (!isNaN(value)) {
          //     lastKeyToDelete = key;
          //   }
          // }
          
          const update = { $unset: { [`otherMessages`]: "" }, $set: {messageTrack:'venue', updatedAt: Date.now() }
          };
          await ChatLogs.updateOne({ _id: latestChatLog?._id }, update);
          

          const ITSmatched = await Contact.findOne({ITS: latestChatLog.requestedITS});
          ITSmatched.lastIzantaken=null
          await ITSmatched.save()

          const response =  await sendMessageFunc({...sendMessageObj,message: activeSet?.ITSverificationMessage.replace('${name}', ITSmatched.name )});
          return res.send(true);
        }

        if (
          (latestChatLog.messageTrack === 'venue' && (isNaN(message) || +message > venueNames.length)) ||
          (latestChatLog.messageTrack === 'profile' && (isNaN(message) || +message > khidmatNames.length))
        ){
          const response = await sendMessageFunc({...sendMessageObj, message: 'Incorrect input. \nPlease enter corresponding number against each option only'} );
          return res.send(true);
        }
        
        let reply = processUserMessage(message, activeSet);
        console.log({latestChatLog})
        if(latestChatLog?.requestedITS && latestChatLog.messageTrack === 'profile'){
          reply = {message : activeSet?.AcceptanceMessage}
          reply.message = reply.message
            .replace('${name}', requestedITS?.name)
            .replace('${ans1}', venueNames[+latestChatLog.otherMessages['venue']-1])
            .replace('${ans2}', khidmatNames[+message-1]);
        }
        if(latestChatLog?.requestedITS && reply?.message) {
          if(latestChatLog.messageTrack === 'profile'){
            const ITSmatched = await Contact.findOne({ITS: latestChatLog?.requestedITS});
            ITSmatched.lastIzantaken = new Date();
            ITSmatched.save()
          }
          // console.log('reply', reply)
          const response = await sendMessageFunc({...sendMessageObj,message:reply?.message });

          // const messages = Object.values(latestChatLog?.otherMessages || {});
          // const isMessagePresent = messages.includes(message.toLowerCase());
          // if (isMessagePresent) {
          //     // If the message is already present, do not update and return
          //     console.log('i am stuck')
          //     return latestChatLog;
          // }

          let messageCount = latestChatLog?.otherMessages ? Object.keys(latestChatLog?.otherMessages).length : 0;
          messageCount++;

          const keyName = `${latestChatLog.messageTrack}`;
          const updateFields = { [`otherMessages.${keyName}`]: message.toLowerCase() , updatedAt: Date.now()} ;
          if(latestChatLog.messageTrack === 'venue'){
            updateFields['messageTrack']='profile'
          }else if(latestChatLog.messageTrack === 'profile'){
            updateFields['messageTrack']='submitted'
          }
          await ChatLogs.findOneAndUpdate(
            {
                senderId: senderId?._id,
                instance_id: messageObject?.instance_id,
                updatedAt: { $gte: start, $lt: end }
            },
            {$set : updateFields},
            { 
                new: true,
                sort: { updatedAt: -1 }
            }
          );
  
          return res.send(true);
        }
        const response = await sendMessageFunc({...sendMessageObj,message:'Invalid Input' });
        return res.send(true);
      }
    }else{
      return res.send(true);
    }
    // Save the message to the database

    // // Emit the message to all clients in the conversation room

  } catch (error) {
    console.error(error);

    res.status(500).json({ error: 'Internal server error' });
  } 
}

const sendMessageFunc = async (message)=>{
  console.log(message)
  const url = process.env.LOGIN_CB_API
  const access_token = process.env.ACCESS_TOKEN_CB
  const response = await axios.get(`${url}/send`,{params:{...message,access_token}})
  return true;
}

function processUserMessage(message, setConfig) {
  // Iterate through setData array to find matching keywords
  // console.log(setConfig.setData)
  if (!message) {
    return null;
  }
  for (const data of setConfig.setData) {
      for (const keyword of data.keywords) {
          if (keyword.toLowerCase().includes(message.toLowerCase())) {
              return data.answer;
          }
      }
  }
  
  return null; // Return default message if no matching keyword is found
}

function getNames(step, number){
  const venueNames = ['Saifee Masjid','Burhani Masjid','MM Warqa']
  const khidmatNames = ['For all Majlis and Miqaat','Only During Ramadan','Only During Ashara','Only During Ramadan and Ashara']
  if(step === 'venue'){
    return venueNames[number-1]
  }else {
    return khidmatNames[number-1]
  }
}

const getReport = async (req, res) => {
  const { fromDate, toDate } = req.query;
  let startDate, endDate;

  if (fromDate && toDate) {
    startDate = new Date(fromDate);
    endDate = new Date(toDate);
  }

  let dateFilter = {};
  if (startDate && endDate) { // If both startDate and endDate are defined, add a date range filter
    dateFilter = {
      "updatedAt": {
        $gte: startDate,
        $lt: endDate
      }
    };
  }

  let query = [
    {
      $lookup: {
        from: 'chatlogs',
        let: { contactITS: '$ITS' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$requestedITS', '$$contactITS'] },
                  { $eq: ['$instance_id', req.params.id] },
                  { $gte: ['$updatedAt', startDate] },
                  { $lt: ['$updatedAt', endDate] }
                ]
              }
            }
          }
        ],
        as: 'chatlog'
      }
    },
    { $unwind: { path: '$chatlog', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        PhoneNumber: { $toString: '$number' }  // Assuming `number` is directly in contacts
      }
    },
    {
      $project: {
        _id: 0,
        ITS: '$ITS',
        Name: '$name',
        PhoneNumber: 1,
        updatedAt: '$chatlog.updatedAt',
        Status: '$chatlog.messageTrack',
        Venue: '$chatlog.otherMessages.venue',
        Response: '$chatlog.otherMessages.profile'
      }
    }
  ];

  try {

const formatDate = (date) => {
      if (!date || isNaN(new Date(date).getTime())) {
        return ''; // Return blank if date is invalid
      }
      const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      };
      return new Date(date).toLocaleString('en-US', options).replace(',', '');
    };

    let data = await Contact.aggregate(query);
    data = data.map(ele=>({
      ...ele,
      'updatedAt': formatDate(ele.updatedAt),
      Venue: getNames('venue', ele?.Venue),
      Response: getNames('profile', ele?.Response),
    }))

    const fileName = `Report-${Date.now()}.csv`
    const filePath = `uploads/reports/${fileName}`;
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'Name', title: 'Name' },
        { id: 'PhoneNumber', title: 'PhoneNumber' },
        { id: 'ITS', title: 'ITS' },
        { id: 'updatedAt', title: 'Updated At' },
        { id: 'Venue', title: 'Venue' },
        { id: 'Response', title: 'Response' },
        { id: 'Status', title: 'Status' },
      ]
    });

    await csvWriter.writeRecords(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

async function getReportdataByTime(startDate, endDate, id){

  let dateFilter = {};
  if (startDate && endDate) { // If both startDate and endDate are defined, add a date range filter
    dateFilter = {
      "updatedAt": {
        $gte: startDate,
        $lt: endDate
      }
    };
  }

  let query = [
    {
      $lookup: {
        from: 'chatlogs',
        let: { contactITS: '$ITS' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$requestedITS', '$$contactITS'] },
                  { $eq: ['$instance_id', id] },
                ]
              }
            }
          }
        ],
        as: 'chatlog'
      }
    },
    { $unwind: { path: '$chatlog', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        PhoneNumber: { $toString: '$number' }  // Assuming `number` is directly in contacts
      }
    },
    {
      $project: {
        _id: 0,
        ITS: '$ITS',
        Name: '$name',
        PhoneNumber: 1,
        updatedAt: '$chatlog.updatedAt',
        Status: '$chatlog.messageTrack',
        Venue: '$chatlog.otherMessages.venue',
        Response: '$chatlog.otherMessages.profile'
      }
    }
  ];

  try {

    const formatDate = (date) => {
      if (!date || isNaN(new Date(date).getTime())) {
        return ''; // Return blank if date is invalid
      }
      const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      };
      return new Date(date).toLocaleString('en-US', options).replace(',', '');
    };

    let data = await Contact.aggregate(query);
    data = data.map(ele=>({
      Name: ele.Name,
      PhoneNumber: ele.PhoneNumber,
      ITS: ele.ITS,
      'Updated At': formatDate(ele.updatedAt),
      Venue: getNames('venue', ele?.Venue),
      Response: getNames('profile', ele?.Response),
    }))

    const fileName = `Report-${Date.now()}.xlsx`
    const filePath = `uploads/reports/${fileName}`;
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Report');
    xlsx.writeFile(wb, filePath);
  
    console.log(`XLSX file created successfully at ${filePath}`);
    
    return filePath;

  } catch (error) {
    console.error(error);
  }
};

async function createPDF(data, filePath) {
  console.log('data',data)
  console.log('filepath',filePath)
 
  const templateSource = fs.readFileSync(`${process.cwd()}/uploads/reports/template.hbs`, 'utf8');
  const template = handlebars.compile(templateSource);
  // Register a helper to increment index
  handlebars.registerHelper('inc', function(value, options) {
    return parseInt(value) + 1;
  });
  const html = template({ records: data });
       
  const options = {
    format: 'A4',
    border: {
      top: '15px',
      right: '10px',
      bottom: '15px',
      left: '10px'
    }
  };
  return new Promise((resolve, reject) => {
    pdf.create(html, options).toFile(`${process.cwd()}${filePath}`, function (err, res) {
      if (err) {
        console.error(err);
        return reject(err);
      }
      console.log('PDF created successfully');
      resolve(res);
    });
  });
}

async function getReportdataByTime1(startDate, endDate, id){

  let dateFilter = {};
  if (startDate && endDate) { // If both startDate and endDate are defined, add a date range filter
    dateFilter = {
        "updatedAt": {
            $gte: startDate,
            $lt: endDate
        }
    };
  }


  let query =[
    {$match: { instance_id:id ,...dateFilter, isValid:true } },
    {$lookup : {
      from: 'contacts',
      localField: 'requestedITS',
      foreignField: 'ITS',
      as: 'contact'
    }},
    {$lookup : {
      from: 'instances',
      localField: 'instance_id',
      foreignField: 'instance_id',
      as: 'instance'
    }},
    {$unwind:{
      path: '$instance',
      preserveNullAndEmptyArrays: true
    }},
    {$unwind:{
      path: '$contact',
      preserveNullAndEmptyArrays: true
    }},
    {
      $addFields: {
        PhoneNumber: { $toString: "$contact.number" }, // Convert to string
      }
    },
    {
      $project: {
        _id: 0,
        Name: '$contact.name',
        PhoneNumber: 1,
        ITS: '$requestedITS',
        Time: '$updatedAt',
        Venue: '$otherMessages.venue',
        Response: '$otherMessages.profile',
        updatedAt: { $dateToString: { format: "%d %m %Y", date: "$updatedAt" } },
      }
    }
  ]
  const data = await ChatLogs.aggregate(query);

  const filePath = `./download.csv`

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'Name', title: 'Name' },
      { id: 'PhoneNumber', title: 'PhoneNumber', stringQuote: '"' },
      { id: 'ITS', title: 'ITS' },
      { id: 'updatedAt', title: 'Updated At' },
      { id: 'Location', title: 'Venue' },
      { id: 'Response', title: 'Response' },
    ]
  });

  await csvWriter.writeRecords(data);
  
  const jsonArray = await csv().fromFile(filePath);
  const pdfFilePath = `uploads/reports/Report-${Date.now()}.pdf`;

  await createPDF(jsonArray,pdfFilePath);
  return filePath ;
}

function isTimeInRange(startTime, endTime, timezoneOffset = 0) {
  // Get the current date/time in UTC
  const nowUtc = new Date();
  console.log({startTime, endTime})
  // Convert it to the target timezone
  const now = new Date(nowUtc.getTime() + timezoneOffset * 60 * 60 * 1000);

  // Parse start and end times as Date objects
  const start = new Date(startTime);
  start.setUTCDate(nowUtc.getUTCDate());
  start.setUTCMonth(nowUtc.getUTCMonth());
  start.setUTCFullYear(nowUtc.getUTCFullYear());

  const end = new Date(endTime);
  end.setUTCDate(nowUtc.getUTCDate());
  end.setUTCMonth(nowUtc.getUTCMonth());
  end.setUTCFullYear(nowUtc.getUTCFullYear());
  console.log(now,start,end)
  // Check if the current time falls within the start and end times
  return now >= start && now <= end;
}

async function getStats(instanceId, startDate, endDate ){
  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = {
      updatedAt: {
        $gte: new Date(startDate),
        $lt: new Date(endDate)
      }
    };
  }
  const totalEntries = await ChatLogs.countDocuments({
    instance_id: instanceId,
    ...dateFilter
  });

  const totalCompletedResponses = await ChatLogs.countDocuments({
    instance_id: instanceId,
    messageTrack: 'submitted',
    ...dateFilter
  });

  const totalIncompleteResponses = await ChatLogs.countDocuments({
    instance_id: instanceId,
    messageTrack: { $in: ['venue', 'profile'] },
    ...dateFilter
  });

  const contactsWithChatlogs = await Contact.aggregate([
    {
      $lookup: {
        from: 'chatlogs',
        let: { contactITS: '$ITS' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$requestedITS', '$$contactITS'] },
                  { $eq: ['$instance_id', instanceId] },
                  ...Object.keys(dateFilter).length ? [dateFilter] : []
                ]
              }
            }
          }
        ],
        as: 'chatlog'
      }
    },
    { $match: { 'chatlog.0': { $exists: true } } }
  ]);

  const totalContacts = await Contact.countDocuments();
  const totalUnresponsiveContacts = totalContacts - contactsWithChatlogs.length;
  console.log(totalEntries,
    totalCompletedResponses,
    totalIncompleteResponses,
    totalUnresponsiveContacts)
  return {
    totalEntries,
    totalCompletedResponses,
    totalIncompleteResponses,
    totalUnresponsiveContacts
  };
}

async function getStats1(instanceId, startDate, endDate) {
  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = {
      updatedAt: {
        $gte: new Date(startDate),
        $lt: new Date(endDate)
      }
    };
  }

  try {
    const [statsResult, contactsWithChatlogs, totalContacts] = await Promise.all([
      ChatLogs.aggregate([
        {
          $match: {
            instance_id: instanceId,
            ...dateFilter
          }
        },
        {
          $facet: {
            totalEntries: [{ $count: "count" }],
            totalCompletedResponses: [
              { $match: { messageTrack: 'submitted' } },
              { $count: "count" }
            ],
            totalIncompleteResponses: [
              { $match: { messageTrack:  { $ne: 'submitted' } }},
              { $count: "count" }
            ]
          }
        }
      ]).then(result => result[0]),

      Contact.aggregate([
        {
          $lookup: {
            from: 'chatlogs',
            let: { contactITS: '$ITS' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$requestedITS', '$$contactITS'] },
                      { $eq: ['$instance_id', instanceId] },
                      dateFilter.updatedAt ? { $gte: ['$updatedAt', dateFilter.updatedAt.$gte] } : {},
                      dateFilter.updatedAt ? { $lt: ['$updatedAt', dateFilter.updatedAt.$lt] } : {}
                    ].filter(Boolean) // Remove empty objects
                  }
                }
              }
            ],
            as: 'chatlog'
          }
        },
        { $match: { 'chatlog.0': { $exists: true } } }
      ]),

      Contact.countDocuments()
    ]);

    const totalEntries = statsResult.totalEntries[0] ? statsResult.totalEntries[0].count : 0;
    const totalCompletedResponses = statsResult.totalCompletedResponses[0] ? statsResult.totalCompletedResponses[0].count : 0;
    const totalIncompleteResponses = statsResult.totalIncompleteResponses[0] ? statsResult.totalIncompleteResponses[0].count : 0;
    const totalUnresponsiveContacts = totalContacts - contactsWithChatlogs.length;


    return {
      totalEntries,
      totalCompletedResponses,
      totalIncompleteResponses,
      totalUnresponsiveContacts
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error; // Ensure errors are thrown to be handled by the calling function
  }
}

module.exports = {
  saveContact,
  getContact,
  updateContacts,
  getMessages,
  sendMessages,
  recieveMessages,
  getReport
};
