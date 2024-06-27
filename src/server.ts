import express from "express"
import bcrypt from "bcrypt"
import cors from "cors"
import bodyParser from "body-parser"
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client";
import authMiddleware from "./middlewares/authmiddleware"


const PORT: number = 3001;
const SECRET_KEY: string = "webops2024"; //for signing the jwt token
const app = express();
const prisma = new PrismaClient();
console.log("Connected to the DB");

//define the interfaces
type User = {
  id:number,
  username:string,
  rollNo:string,
  email:string,
  password:string
}
interface Product 
{
  name: string,
  description: string,
  category: string,
  costPrice: number,
  sellingPrice: number,
  image: string,
  userId: number,
  
  condition: string
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
  const { username, password, email, rollNo } = req.body;
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
          rollNo:rollNo
        },
      });
      if (user) {
        const token: string = jwt.sign({userId: user.id}, SECRET_KEY);
        res.status(200).json({ message: "User created successfully." , token:token});
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
  const { rollNo, password } = req.body;

  //check if the user exists on the DB,if exists retreive it and compare the password
  const user: User | null = await prisma.user.findUnique({
    where: {
      rollNo: rollNo,
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
          const token: string = jwt.sign({userId: user.id}, SECRET_KEY);
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

// user-info routes
app.get("/user/:id", async (req: any, res: any) => {
  const { id } = req.params;
  const user: User | null = await prisma.user.findUnique({
    where: {
      id: parseInt(id),
    },
  });
  if (user) {
    res.status(200).json({ message: "User found", user: user });
  } else {
    res.status(404).json({ message: "No user found with the given id." });
  }
}
);

//delete all users
app.delete("/users",async (req,res)=>{
  await prisma.user.deleteMany().then(()=>{return res.json({message:"deleted all users."})})
})

//product routes
app.post("/product/add",authMiddleware,async (req: any,res: any)=>{
  //we need to add a auth middleware here to check if the user is authenticated or not.
  
  //here the data about the product that we are getting must be in sync with the prisma schema so that we don't need to desructure it.
  const productData = req.body;
  console.log(productData.name)
  
  //now create the product in the database
  try 
  {
    const product: Product = {
      name: productData.name,
      description: productData.description,
      
      image:productData.image,
      userId: req.userId, //this is the user id that we are getting from the auth middleware.
      category:productData.category,
      costPrice: productData.costPrice,
      sellingPrice: productData.sellingPrice,
      condition: productData.condition
    }
    const productAdded = await prisma.product.create({
      data:product
    })
    res.status(200).json({message:"Product added successfully."});
  }
  catch(err)
  {
      console.log(err)
      res.status(500).json({message:"Error adding the product, please try again."})
  }
  

})

app.get("/products",async (req:any, res: any)=>{
  // get all the products requesting to this route.
  try 
  {
    const products = await prisma.product.findMany({
      include:{
        user:true
      }
    })
    res.status(200).json({message:"Retrieval successfull!",products:products})
  }
  catch(err)
  {
    console.log(err)
    res.status(500).json({message:"Internal server error."})
  }
  
  
})

//delete all products
app.delete("/products",async (req:any, res: any)=>{
  // get all the products requesting to this route.
  try 
  {
    const products = await prisma.product.deleteMany({
     
    })
    res.status(200).json({message:"deleted! successfull!",products:products})
  }
  catch(err)
  {
    console.log(err)
    res.status(500).json({message:"Internal server error."})
  }
  
  
})

app.get("/product/:id", async (req:any, res:any)=>{
  const {id} = req.params;
  try 
  {
    const product: Product | null = await prisma.product.findUnique({
      where:{
        productId: parseInt(id)
      },
      include:{
        user:true
      }
    })
    if (product)
    {
      
      res.status(200).json({message:"Product found.",product:product})
    }
    else 
    {
      res.status(200).json({message:"No product found with the given id."})
    }
  }
  catch(err)
  {
    console.log(err)
    res.status(500).json({message:"Internal server error."})
  }
})

//chat logic for people.


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
 