const axios = require('axios');
axios.post('http://localhost:3000/api/webhooks/pagarme', {
  id: 'charge_fake',
  type: 'order.paid',
  data: {
    code: 'loja_00cab618-deb0-4d5c-b99f-85425da7eeb6'
  }
}).then(res => console.log(res.data)).catch(err => console.error(err.response?.data || err.message));
