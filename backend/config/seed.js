const User = require('../models/User');

/**
 * On every server start, check if any admin exists.
 * If not, create one from ADMIN_* env variables (or safe defaults).
 * This means you never need to touch MongoDB Compass to bootstrap the app.
 */
const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) return; // already have at least one admin — nothing to do

    const username = process.env.ADMIN_USERNAME || 'admin';
    const email    = process.env.ADMIN_EMAIL    || 'admin@nexuscollab.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';

    // Check if the username/email is already taken by a non-admin (edge case)
    const conflict = await User.findOne({ $or: [{ email }, { username }] });
    if (conflict) {
      // Promote the existing account to admin instead of creating a duplicate
      conflict.role = 'admin';
      await conflict.save();
      console.log(`🔑 Promoted existing user "${conflict.username}" to admin`);
      return;
    }

    await User.create({ username, email, password, role: 'admin' });
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║         DEFAULT ADMIN ACCOUNT CREATED        ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Username : ${username.padEnd(32)}║`);
    console.log(`║  Email    : ${email.padEnd(32)}║`);
    console.log(`║  Password : ${password.padEnd(32)}║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  ⚠  Change the password after first login!  ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  } catch (err) {
    console.error('Seed admin error:', err.message);
  }
};

module.exports = seedAdmin;
