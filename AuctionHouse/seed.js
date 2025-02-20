const bcrypt = require("bcryptjs");
const { Permit, User } = require("./models");
const connectDB = require("./db");

const seedDatabase = async () => {
  await connectDB();

  // Sample Permits
  const permits = [
    { name: "Fireworks Emporium", description: "Fireworks for celebrations." },
    { name: "Wood Block Depot", description: "All types of wood blocks." },
    { name: "Redstone Engineer", description: "Redstone components and contraptions." },
    { name: "Armory", description: "Weapons and armor." }
  ];

  await Permit.insertMany(permits);
  console.log("Permits added!");

  // Sample Users
  const hashedPassword = await bcrypt.hash("password123", 10);
  const users = [
    { username: "admin", passwordHash: hashedPassword, coins: 500 },
    { username: "player1", passwordHash: hashedPassword, coins: 200 }
  ];

  await User.insertMany(users);
  console.log("Users added!");

  process.exit();
};

seedDatabase();
