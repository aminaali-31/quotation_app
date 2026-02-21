require('dotenv').config();
const express = require('express');
const db = require('./config/db');
const path = require('path');

const app = express();

app.set("view engine" , "ejs");
app.set("views", path.join(__dirname,"views"));
app.use(express.static(path.join(__dirname,"public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send("Quotation App is Running");
});

app.get('/admin/add-product', (req,res) => {
  db.query("SELECT * FROM categories", (err,results) => {
    if (err){
      console.log(err);
      return res.send("Database Error")
    }
    // Else send data
    return res.render('add_product', { categories: results})
  });
  
});
app.post('/admin/add-product', (req, res) => {

  const { serial, name, cPrice, cost, category } = req.body;

  db.query(
    `INSERT INTO products 
     (serial_no, description, price, cost, category_id)
     VALUES (?, ?, ?, ?, ?)`,
    [serial, name, cPrice, cost, category],
    (err) => {
      if (err) {
        console.log(err);
        return res.redirect('/admin/add-product');
      }

      return res.redirect('/admin/add-product');
    }
  );

});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});