const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(express.static('public'));
app.use(cors({origin: '*'}));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/adminpanel.html')
})

const PORT = 3000;

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs')

// Swagger документация
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Task Management API',
            version: '1.0.0',
            description: 'API для управления задачами',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
            },
        ],
    },
    apis: ['openapi.yaml'], // укажите путь к файлам с аннотациями
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// Middleware для парсинга JSON
app.use(bodyParser.json());


// Получить список данных
app.get('/products', (req, res) => {
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        res.json(jsonData.products);
    });
});

app.get('/categories', (req, res) => {
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        res.json(jsonData.categories);
    });
});

// Endpoints for cart and orders
app.get('/cart', (req, res) => {
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        const cartWithProducts = jsonData.cart.map(item => {
            const product = jsonData.products.find(p => p.id === item.productId);
            return {
                ...item,
                product
            };
        });
        res.json(cartWithProducts);
    });
});

app.get('/orders', (req, res) => {
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        res.json(jsonData.orders);
    });
});

// Create new order
app.post('/orders', (req, res) => {
    const { customerName, customerEmail, customerPhone, items } = req.body;
    
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        
        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item' });
        }
        
        // Enrich items with product information
        const enrichedItems = items.map(item => {
            const product = jsonData.products.find(p => p.id === item.productId);
            if (!product) {
                return {
                    ...item,
                    price: 0
                };
            }
            return {
                ...item,
                price: product.price
            };
        });
        
        // Create order
        const newOrder = {
            id: jsonData.orders.length + 1,
            customerName,
            customerEmail,
            customerPhone,
            items: enrichedItems,
            status: 'new',
            createdAt: new Date().toISOString(),
            totalAmount: enrichedItems.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0)
        };
        
        jsonData.orders.push(newOrder);
        
        fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
            if (err) throw err;
            res.status(201).json(newOrder);
        });
    });
});

// Update order status
app.put('/orders/:id', (req, res) => {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status || !['new', 'processing', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }
    
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        const order = jsonData.orders.find(o => o.id === orderId);
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.status = status;
        
        fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
            if (err) throw err;
            res.json(order);
        });
    });
});

// Delete order
app.delete('/orders/:id', (req, res) => {
    const orderId = parseInt(req.params.id);
    
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        jsonData.orders = jsonData.orders.filter(o => o.id !== orderId);
        
        fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
            if (err) throw err;
            res.status(204).send();
        });
    });
});

// Создать новый объект
app.post('/products', (req, res) => {
    const { name, price, description, categoryIds } = req.body;
    const newProduct = {
        id: 0,
        name: name,
        price: price,
        description: description,
        categoryIds: categoryIds,
    };
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        if (categoryIds.some((el) => jsonData.categories.find(t => parseInt(t.id) === parseInt(el)) === undefined)) {
            res.status(404).json({ message: 'Category not found.' });
            return;
        }
        newProduct.id = jsonData.products.length + 1;
        jsonData.products.push(newProduct);
        fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
            if (err) throw err;
        });
    });
    res.status(201).json(newProduct);
});
app.post('/categories', (req, res) => {
    const { name } = req.body;
    const newCategory = {
        id: 0,
        name: name,
    };
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        newCategory.id = jsonData.categories.length + 1;
        jsonData.categories.push(newCategory);
        fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
            if (err) throw err;
        });
    });
    res.status(201).json(newCategory);
});

// Обновить объекты по ID
app.put('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        const product = jsonData.products.find(t => t.id === productId);
        if (product) {
            const { name, price, description, categoryIds } = req.body;
            product.name = name !== undefined ? name : product.title;
            product.price = price !== undefined ? price : product.price;
            product.description = description !== undefined ? description : product.description;
            product.categoryIds = categoryIds !== undefined ? categoryIds : product.categoryIds;
            if (categoryIds.some((el) => jsonData.categories.find(t => parseInt(t.id) === parseInt(el)) === undefined)) {
                res.status(404).json({ message: 'Category not found.' });
                return;
            }
            fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
                if (err) throw err;
            });
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    });
});

app.put('/categories/:id', (req, res) => {
    const categoryId = parseInt(req.params.id);
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        const category = jsonData.categories.find(t => t.id === categoryId);
        if (category) {
            const { name } = req.body;
            category.name = name !== undefined ? name : category.title;
            fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
                if (err) throw err;
            });
            res.json(category);
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    });
});

// Удалить объект по ID
app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        jsonData.products = jsonData.products.filter(t => t.id !== productId);
        fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
            if (err) throw err;
        });
    });
    res.status(204).send();
});

app.delete('/categories/:id', (req, res) => {
    const categoryId = parseInt(req.params.id);
    fs.readFile('./data.json', 'utf-8', function(err, data) {
        if (err) throw err

        let jsonData = JSON.parse(data);
        jsonData.products = jsonData.products.filter(t => !t.categoryIds.includes(categoryId));
        jsonData.categories = jsonData.categories.filter(t => t.id !== categoryId);
        fs.writeFile('./data.json', JSON.stringify(jsonData), 'utf-8', function(err) {
            if (err) throw err;
        });
    });
    res.status(204).send();
});

// Запуск сервера
app.listen(PORT, () => {
    console.log("Server is running on http://localhost:", PORT);
});