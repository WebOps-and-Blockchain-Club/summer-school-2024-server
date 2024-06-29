import express, { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "./middlewares/authmiddleware";
import dotenv from "dotenv";
import cookie from "cookie";
const WebSocket = require("ws");
const PORT: number = 3002;
const SECRET_KEY: string = "webops2024"; //for signing the jwt token
const app = express();
const prisma = new PrismaClient();
dotenv.config();

console.log("Connected to the DB");

// Define the interfaces
type User = {
  id: number;
  username: string;
  rollNo: string;
  email: string;
  password: string;
};

interface Product {
  name: string;
  description: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  image: string;
  userId: number;
  condition: string;
}

interface Message {
  senderId: number;
  roomName: string;
  text: string;
}

// Add the necessary middlewares
app.use(cors());
app.use(bodyParser.json());

// Index route
app.get("/", (req: Request, res: Response) => {
  res.send("Server running");
});

// Auth routes
app.post("/signup", async (req: Request, res: Response) => {
  const { username, password, email, rollNo } = req.body;
  const saltRounds: number = 10;

  console.log(username, password, email);

  // Hashing the password using bcrypt
  try {
    const hashedPassword: string = await bcrypt.hash(password, saltRounds);
    console.log("Password hashed successfully.");
    const user = await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
        email: email,
        rollNo: rollNo,
      },
    });
    if (user) {
      const token: string = jwt.sign({ userId: user.id }, SECRET_KEY);
      res
        .status(200)
        .json({ message: "User created successfully.", token: token });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error: " + err });
  }
});

app.post("/signin", async (req: Request, res: Response) => {
  const { rollNo, password } = req.body;

  const user: User | null = await prisma.user.findUnique({
    where: {
      rollNo: rollNo,
    },
  });

  if (user) {
    try {
      const result: boolean = await bcrypt.compare(password, user.password);
      if (result) {
        const token: string = jwt.sign({ userId: user.id }, SECRET_KEY);
        res.status(200).json({ token: token, message: "Login successful" });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(401).json({ message: "No user found with the given username." });
  }
});

// User-info routes
app.get("/user/:id", authMiddleware, async (req: any, res: Response) => {
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
});
console.log("hello 1");
app.get("/user", authMiddleware, async (req: any, res: Response) => {
  const id = req.userId;
  const user: User | null = await prisma.user.findUnique({
    where: {
      id: id,
    },
  });
  if (user) {
    res.status(200).json({ message: "User found", user: user });
  } else {
    res.status(404).json({ message: "No user found with the given id." });
  }
});

// Delete all users
app.delete("/users", async (req: Request, res: Response) => {
  await prisma.user.deleteMany();
  res.json({ message: "deleted all users." });
});

// Product routes
app.post("/product/add", authMiddleware, async (req: any, res: Response) => {
  const productData = req.body;

  try {
    const product: Product = {
      name: productData.name,
      description: productData.description,
      image: productData.image,
      userId: req.userId,
      category: productData.category,
      costPrice: productData.costPrice,
      sellingPrice: productData.sellingPrice,
      condition: productData.condition,
    };
    await prisma.product.create({
      data: product,
    });
    res.status(200).json({ message: "Product added successfully." });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Error adding the product, please try again." });
  }
});

app.get("/products", async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        user: true,
      },
    });
    res
      .status(200)
      .json({ message: "Retrieval successful!", products: products });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete all products
app.delete("/products", async (req: Request, res: Response) => {
  try {
    await prisma.product.deleteMany({});
    res.status(200).json({ message: "Deleted successfully!" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/product/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const product: Product | null = await prisma.product.findUnique({
      where: {
        productId: parseInt(id),
      },
      include: {
        user: true,
      },
    });
    if (product) {
      res.status(200).json({ message: "Product found.", product: product });
    } else {
      res.status(200).json({ message: "No product found with the given id." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Chat logic for messages
app.get("/messages/:roomName", async (req: Request, res: Response) => {
  const { roomName } = req.params;
  try {
    const messages: Message[] = await prisma.message.findMany({
      where: {
        roomName: roomName,
      },
    });
    res.json({ messages: messages });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
const wss = new WebSocket.Server({ server });
interface ChatRooms {
  [roomName: string]: WebSocket[];
}
const chatRooms: ChatRooms = {};

wss.on("connection", (ws: WebSocket, req: Request) => {
  const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  const token = cookies.token;

  if (!token) {
    ws.close();
    return;
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { userId: number };
    (ws as any).userId = decoded.userId;
  } catch (error) {
    ws.close();
  }

  ws.onmessage = async (event: MessageEvent) => {
    const message: Message = JSON.parse(event.data.toString());
    const { roomName, text } = message;

    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
    }

    chatRooms[roomName].push(ws);

    console.log(
      `Received message from user ${
        (ws as any).userId
      } in room ${roomName}: ${text}`
    );

    // Broadcast message to all clients in the same room
    const createmsg = await prisma.message.create({
      data: {
        text,
        senderId: (ws as any).userId,
        roomName,
      },
    });
    chatRooms[roomName].forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({ senderId: (ws as any).userId, message: text })
        );
      }
    });
  };

  ws.onclose = () => {
    console.log(`Connection closed for user ${(ws as any).userId}`);
    Object.keys(chatRooms).forEach((roomName) => {
      chatRooms[roomName] = chatRooms[roomName].filter(
        (client) => client !== ws
      );
      if (chatRooms[roomName].length === 0) {
        delete chatRooms[roomName];
      }
    });
  };
});
