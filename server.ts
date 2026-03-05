import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const app = express();
const PORT = 3000;
const db = new Database("zapcharger.db");

// Initialize Database
// We drop tables if we need to force a schema update in this dev environment
// db.exec("DROP TABLE IF EXISTS reservations; DROP TABLE IF EXISTS time_slots; DROP TABLE IF EXISTS stations; DROP TABLE IF EXISTS users;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    distance TEXT NOT NULL,
    status TEXT DEFAULT 'Available',
    fast_charging INTEGER DEFAULT 1,
    total_slots INTEGER DEFAULT 24,
    price_per_kwh TEXT DEFAULT '₹15.00'
  );

  CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER,
    time_label TEXT NOT NULL,
    FOREIGN KEY(station_id) REFERENCES stations(id)
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER,
    time_slot_id INTEGER,
    user_id INTEGER,
    booking_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES stations(id),
    FOREIGN KEY(time_slot_id) REFERENCES time_slots(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(station_id, time_slot_id, booking_date)
  );
`);

// Migration: Check if booking_date exists in reservations
try {
  db.prepare("SELECT booking_date FROM reservations LIMIT 1").get();
} catch (e) {
  // If it fails, the column likely doesn't exist. Drop and recreate for simplicity in dev.
  db.exec("DROP TABLE IF EXISTS reservations;");
  db.exec(`
    CREATE TABLE reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER,
      time_slot_id INTEGER,
      user_id INTEGER,
      booking_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(station_id) REFERENCES stations(id),
      FOREIGN KEY(time_slot_id) REFERENCES time_slots(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(station_id, time_slot_id, booking_date)
    );
  `);
}

// Seed data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)").run("user@example.com", "password123", "John Doe");
}

const stationCount = db.prepare("SELECT COUNT(*) as count FROM stations").get() as { count: number };
if (stationCount.count === 0) {
  const insertStation = db.prepare("INSERT INTO stations (name, location, distance, status, fast_charging, total_slots, price_per_kwh) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const insertSlot = db.prepare("INSERT INTO time_slots (station_id, time_label) VALUES (?, ?)");

  const seedStations = [
    ["EcoCharge Hub - Bangalore", "Indiranagar, Bangalore", "1.2 km", "Available", 1, 24, "₹18.50"],
    ["VoltStation Mumbai", "Andheri West, Mumbai", "2.5 km", "High Wait", 1, 24, "₹22.00"],
    ["GreenGrid Delhi EV", "Connaught Place, Delhi", "3.8 km", "Full", 0, 24, "₹15.00"],
    ["ZapCharger Chennai", "OMR, Chennai", "5.0 km", "Available", 1, 24, "₹19.50"],
    ["Community Charge Hyderabad", "Gachibowli, Hyderabad", "1.5 km", "Available", 0, 24, "₹16.00"]
  ];

  seedStations.forEach((s) => {
    const result = insertStation.run(...s);
    const stationId = result.lastInsertRowid;
    // Generate 24 slots (one for each hour)
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      insertSlot.run(stationId, `${hour}:00`);
    }
  });
}

app.use(express.json());

// API Routes
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT id, email, name FROM users WHERE email = ? AND password = ?").get(email, password) as any;
  
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.get("/api/stations", (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const stations = db.prepare(`
    SELECT s.*, 
    (SELECT COUNT(*) FROM time_slots ts 
     WHERE ts.station_id = s.id 
     AND ts.id NOT IN (SELECT time_slot_id FROM reservations WHERE booking_date = ? AND station_id = s.id)) as available_slots
    FROM stations s
  `).all(date);
  res.json(stations);
});

app.get("/api/stations/:id/slots", (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const slots = db.prepare(`
    SELECT ts.*, 
    (SELECT COUNT(*) FROM reservations r WHERE r.time_slot_id = ts.id AND r.booking_date = ?) as is_booked
    FROM time_slots ts 
    WHERE ts.station_id = ?
  `).all(date, req.params.id);
  res.json(slots);
});

app.get("/api/my-bookings/:userId", (req, res) => {
  const bookings = db.prepare(`
    SELECT r.*, s.name as station_name, s.location, ts.time_label
    FROM reservations r
    JOIN stations s ON r.station_id = s.id
    JOIN time_slots ts ON r.time_slot_id = ts.id
    WHERE r.user_id = ?
    ORDER BY r.booking_date DESC, ts.time_label DESC
  `).all(req.params.userId);
  res.json(bookings);
});

app.post("/api/reservations", (req, res) => {
  const { stationId, slotId, userId, bookingDate } = req.body;
  
  try {
    const transaction = db.transaction(() => {
      // Check if already booked for this specific date and slot
      const existing = db.prepare("SELECT id FROM reservations WHERE station_id = ? AND time_slot_id = ? AND booking_date = ?").get(stationId, slotId, bookingDate);
      if (existing) throw new Error("Slot already booked for this date");

      // Insert reservation
      db.prepare("INSERT INTO reservations (station_id, time_slot_id, user_id, booking_date) VALUES (?, ?, ?, ?)").run(stationId, slotId, userId, bookingDate);
    });

    transaction();
    res.json({ success: true, message: "Reservation confirmed" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
