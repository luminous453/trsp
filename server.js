const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ port: 9000 });

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors({origin: '*'}));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/user.html');
});

const PORT = 8080;

// GraphQL схема
const schema = buildSchema(`
    type Category {
        id: ID!
        name: String!
        products: [Product]
    }

    type Product {
        id: ID!
        name: String!
        price: Int!
        description: String!
        categoryIds: [ID!]!
    }

    type CartItem {
        id: ID!
        productId: ID!
        quantity: Int!
        product: Product
    }

    type Query {
        categories: [Category]
        cart: [CartItem]
    }
`);


let root = {
    categories: () => {
        const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
        let categoriesRes = [];
        for(let category of data.categories) {
            category.products = [];
            for(let Product of data.products ){
                for(let categoryId of Product.categoryIds) {
                    if(parseInt(categoryId) === parseInt(category.id)) {
                        category.products.push(Product)
                        break
                    }
                }

            }
            categoriesRes.push(category)
        }
        return categoriesRes
    },
    cart: () => {
        const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
        const cartWithProducts = data.cart.map(item => {
            const product = data.products.find(p => p.id === item.productId);
            return {
                ...item,
                product
            };
        });
        return cartWithProducts;
    }
}

app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
}));

// Cart API endpoints
app.get('/api/cart', (req, res) => {
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
    const cartWithProducts = data.cart.map(item => {
        const product = data.products.find(p => p.id === item.productId);
        return {
            ...item,
            product
        };
    });
    res.json(cartWithProducts);
});

app.post('/api/cart', (req, res) => {
    const { productId, quantity } = req.body;
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
    
    // Check if product exists
    const product = data.products.find(p => p.id === parseInt(productId));
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if item already in cart
    const existingItemIndex = data.cart.findIndex(item => item.productId === parseInt(productId));
    
    if (existingItemIndex >= 0) {
        // Update quantity if already in cart
        data.cart[existingItemIndex].quantity += parseInt(quantity);
    } else {
        // Add new item to cart
        const newItem = {
            id: data.cart.length + 1,
            productId: parseInt(productId),
            quantity: parseInt(quantity)
        };
        data.cart.push(newItem);
    }
    
    fs.writeFileSync('./data.json', JSON.stringify(data), 'utf-8');
    res.status(201).json(data.cart);
});

app.delete('/api/cart/:id', (req, res) => {
    const itemId = parseInt(req.params.id);
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
    
    data.cart = data.cart.filter(item => item.id !== itemId);
    
    fs.writeFileSync('./data.json', JSON.stringify(data), 'utf-8');
    res.status(200).json({ message: 'Item removed from cart' });
});

app.delete('/api/cart', (req, res) => {
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
    
    data.cart = [];
    
    fs.writeFileSync('./data.json', JSON.stringify(data), 'utf-8');
    res.status(200).json({ message: 'Cart cleared' });
});

// WebSocket соединение
let clients = []
wss.on('connection', (client) => {
    console.log('Client connected');
    clients.push(client)

    client.on('message', (message) => {
        const data = JSON.parse(message)
        for(const Client of clients) {
            Client.send(JSON.stringify(data));
        }
        console.log(`Received message: ${message}`);
    });

    client.on('close', () => {
        const index = clients.indexOf(client);
        if (index !== -1) {
            clients.splice(index, 1);
        }

        console.log('Client disconnected');
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});