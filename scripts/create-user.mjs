import fs from 'fs';
import path from 'path';

// Usage: node scripts/create-user.mjs [role] [displayName] [phone] [email]
const role = process.argv[2] || 'listener';
const displayName = process.argv[3] || `User_${Date.now().toString().slice(-4)}`;
const phone = process.argv[4] || `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
const email = process.argv[5] || `${displayName.toLowerCase().replace(/\s+/g, '_')}@kathalu.app`;

console.log(`Creating test user:
- Role: ${role}
- Name: ${displayName}
- Phone: ${phone}
- Email: ${email}
`);

const newUser = {
  id: `usr-${Date.now()}`,
  email,
  phone,
  display_name: displayName,
  username: displayName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${displayName}`,
  bio: `Telugu ${role} account created via script.`,
  role,
  show_age_city: false,
  is_minor: false,
  guardian_consent: false,
  testOtp: '123456',
  created_at: new Date().toISOString(),
};

console.log('✓ Created User:', newUser);

