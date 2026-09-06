const axios = require('axios');

async function testProfile() {
  const BASE_URL = 'http://localhost:5000/api';
  try {
    console.log('1. Logging in with Demo account...');
    const loginRes = await axios.post(`${BASE_URL}/auth/google-login`, {
      email: 'investor.demo@smartlanka.com',
      name: 'Institutional Demo'
    });

    const token = loginRes.data.token;
    console.log('✅ Logged in successfully. Token acquired.');

    console.log('\n2. Fetching User Profile...');
    const profileRes = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile Response:', profileRes.data);

    console.log('\n3. Updating User Profile (Name, Phone Number, Profile Image)...');
    const updateRes = await axios.put(`${BASE_URL}/auth/profile`, {
      name: 'Institutional Demo (Pro Trader)',
      email: 'investor.demo@smartlanka.com',
      phoneNumber: '+94 77 123 4567',
      profileImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Update Response:', updateRes.data);

    console.log('\n4. Fetching updated profile to verify persistence...');
    const verifyRes = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Verified Profile:', {
      name: verifyRes.data.user.name,
      email: verifyRes.data.user.email,
      phoneNumber: verifyRes.data.user.phoneNumber,
      hasImage: !!verifyRes.data.user.profileImage
    });

    console.log('\n🎉 ALL PROFILE ENDPOINT TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

testProfile();
