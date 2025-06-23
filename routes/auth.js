const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

router.post('/register', async (req, res) => {
    const { login, password } = req.body;
    
    try {
        // Проверка существования пользователя
        const userExists = await pool.query(
            'SELECT * FROM users WHERE login = $1',
            [login]
        );
        
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Логин уже занят' });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Формируем массив тестов по умолчанию
        const defaultTests = [
            { testid: 1, score: 0, passed: false },
            { testid: 2, score: 0, passed: false },
            { testid: 3, score: 0, passed: false },
            { testid: 4, score: 0, passed: false },
            { testid: 5, score: 0, passed: false },
            { testid: 6, score: 0, passed: false },
            { testid: 7, score: 0, passed: false },
            { testid: 8, score: 0, passed: false },
            { testid: 9, score: 0, passed: false },
            { testid: 10, score: 0, passed: false }
        ];

        // Вставка данных
        await pool.query(
            `INSERT INTO users (login, password, test_info)
            VALUES ($1, $2, $3::jsonb[])`,
            [
                login,
                hashedPassword,
                defaultTests,
            ]
        );

        res.status(201).json({ message: 'Регистрация успешна' });

    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
router.post('/login', async (req, res) => {
    const { login, password } = req.body;

    try {
        // 1. Проверяем наличие логина и пароля в запросе
        if (!login || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        // 2. Ищем пользователя в базе данных
        const result = await pool.query(
            'SELECT * FROM users WHERE login = $1',
            [login]
        );

        // 3. Если пользователь не найден
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const user = result.rows[0];

        // 4. Сравниваем пароли
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        // 5. Формируем ответ без пароля
        const userResponse = {
            login: user.login,
            admin: user.admin,
            test_info: user.test_info
        };

        res.json({
            message: 'Вход выполнен успешно',
            user: userResponse
        });

    } catch (err) {
        console.error('Ошибка при входе:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
module.exports = router;  