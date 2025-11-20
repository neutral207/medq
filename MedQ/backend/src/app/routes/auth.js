const express = reguire("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = "secret-key";

const user = {
    id: 1,
    username: "admin",
    // password = admin123
    passwordHash: bcrypt.hashSync ("admin123", 12)
}


router.post("/login", async (req, res) => {
    const {username, password} = req.body;

    if (!username || !password) {
    return res.status(400).json({ error: "missing username or password" });
  }

  // this find user
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ error: "invalid username or password" });
  }

  // this compare password using bcrypt
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "invalid username or password" });
  }

  // this create JWT token
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return res.json({
    message: "Login successful",
    token
  });
});

module.exports = router;
    
