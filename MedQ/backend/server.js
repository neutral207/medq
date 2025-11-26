const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const bodyParser = require ("body-parser");

const app = express();
app.use(bodyParser.json());

// this would use the secret key 
const JWR_SECRET = "our_secret_key_ here";

// this would be an example user 
const users = [ {
    id: 1,
    username: "admin",
    passwordHash: bcrypt.hashSync("password123", 10)
}
];

// this is the post /api/longin authenticate user and issue JWT
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

    // this will check if  user exists 
    const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }


    // this check password 
   const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  };

// sign JWT token (expires in 1 hour)
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h"});

// this will send the token back
res.json({ token});
});

// this is the example protected route
app.get("/api/protected", (req, res) => {
    const autHeader = req.headers["authorization"];
    const token = autHeader && authHeader.split(" ")[1];
    if (!token)return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
       if (err) return res.sendStatus(403); 
       res.json({ message: "access granted to prtotrcted route", user});
    });
});

// this should stat the server 
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
