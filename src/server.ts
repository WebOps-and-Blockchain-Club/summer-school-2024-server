import express from "express"
import bcrypt from "bcrypt"
import cors from "cors"
import bodyParser from "body-parser"
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client";


const PORT: number = 3000;
const SECRET_KEY: string = "webops2024";
const app = express();
const prisma = new PrismaClient();
console.log("Connected to the DB");

//define the interfaces
interface User  
{
  id: number,
  username: string,
  password: string,
  email: string
}


//add the necessary middlewares
app.use(cors());
app.use(bodyParser.json());

//index route
app.get("/", (req: any, res: any) => {
  res.send("Server running");
});
  
//auth routes
app.post("/signup", (req: any, res: any) => {
  const { username, password, email } = req.body;
  const saltRounds: number = 10;

  console.log(username, password, email);

  //hashing the password using bcrypt js

  bcrypt
    .hash(password, saltRounds)
    .then(async (hashedPassword: string) => {
      //create the user here.
      console.log("Password hashed successfully.");
      const user = await prisma.user.create({
        data: {
          username: username,
          password: hashedPassword,
          email: email,
        },
      });
      if (user) {
        res.status(200).json({ message: "User created successfully." });
      }
    })
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .json({ message: "Server error: "+err }); //this here would basically return an error if the username is already taken. or for any other error, the error will be sent to the frontend.
        
    });
});

app.post("/signin", async (req: any, res: any) => {
  const { username, password } = req.body;

  //check if the user exists on the DB,if exists retreive it and compare the password
  const user: User | null = await prisma.user.findUnique({
    where: {
      username: username,
    },
  });
  if (user) {
    //if user exists, log him in
    const hashedPassword = user.password;
    bcrypt
      .compare(password, hashedPassword) //hashedPassword will be retreived from the database.
      .then((result: boolean) => {
        if (result) {
          //now send the token to the client and make it store in the localstorage.
          const token: string = jwt.sign({ username: username }, SECRET_KEY);
          res.status(200).json({ token: token, message: "Login successful" });
        } else {
          res.status(401).json({ message: "Invalid credentials" });
        }
      })
      .catch((err ) => {
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    res.status(401).json({ message: "No user found with the given username." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
