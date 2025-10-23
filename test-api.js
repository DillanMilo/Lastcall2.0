// Quick API test script
// Run with: node test-api.js

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('🧪 Testing LastCall API...\n');

  try {
    // 1. GET all inventory
    console.log('1️⃣  Testing GET /api/inventory');
    const getRes = await fetch(`${BASE_URL}/inventory?org_id=${ORG_ID}`);
    const getData = await getRes.json();
    console.log(`✅ Found ${getData.count} items\n`);

    // 2. POST new item
    console.log('2️⃣  Testing POST /api/inventory');
    const postRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: ORG_ID,
        items: [
          {
            name: 'API Test Product',
            sku: 'API-TEST-001',
            quantity: 99,
            reorder_threshold: 20,
          },
        ],
      }),
    });
    const postData = await postRes.json();
    console.log(`✅ Created item:`, postData.items[0].name);
    const newItemId = postData.items[0].id;
    console.log(`   Item ID: ${newItemId}\n`);

    // 3. GET single item
    console.log('3️⃣  Testing GET /api/inventory/:id');
    const getOneRes = await fetch(`${BASE_URL}/inventory/${newItemId}`);
    const getOneData = await getOneRes.json();
    console.log(`✅ Retrieved: ${getOneData.item.name}\n`);

    // 4. PATCH update quantity
    console.log('4️⃣  Testing PATCH /api/inventory/:id');
    const patchRes = await fetch(`${BASE_URL}/inventory/${newItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 150 }),
    });
    const patchData = await patchRes.json();
    console.log(`✅ Updated quantity to: ${patchData.item.quantity}\n`);

    // 5. DELETE item
    console.log('5️⃣  Testing DELETE /api/inventory/:id');
    const deleteRes = await fetch(`${BASE_URL}/inventory/${newItemId}`, {
      method: 'DELETE',
    });
    const deleteData = await deleteRes.json();
    console.log(`✅ ${deleteData.message}\n`);

    // 6. Test sync endpoint
    console.log('6️⃣  Testing POST /api/inventory/sync');
    const syncRes = await fetch(`${BASE_URL}/inventory/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: ORG_ID,
        source: 'test_api',
        items: [
          {
            name: 'Sync Test Product 1',
            sku: 'SYNC-001',
            quantity: 50,
          },
          {
            name: 'Sync Test Product 2',
            sku: 'SYNC-002',
            quantity: 75,
          },
        ],
      }),
    });
    const syncData = await syncRes.json();
    console.log(`✅ ${syncData.summary}\n`);

    console.log('🎉 All API tests passed!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run tests
testAPI();

