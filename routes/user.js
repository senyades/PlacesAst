const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

router.post('/update', async (req, res) => {
    const { login, password, newScore } = req.body;
    try {
        // 1. Проверяем существование пользователя
        const user = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Проверяем пароль
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // 3. Обновляем счет добавлением новых баллов
        await pool.query(
            'UPDATE users SET score = score + $1 WHERE login = $2',
            [newScore, login]
        );

        // 4. Возвращаем новый общий счет
        const updatedUser = await pool.query(
            'SELECT score FROM users WHERE login = $1',
            [login]
        );
        
        res.json({ 
            message: 'Score updated',
            newTotalScore: updatedUser.rows[0].score
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


router.put('/reset-password', async (req, res) => {
    const { adminLogin, adminPassword, targetLogin, newPassword } = req.body;
    
    try {
        // Проверка прав администратора
        const admin = await pool.query('SELECT * FROM users WHERE login = $1', [adminLogin]);
        if (!admin.rows[0]?.admin) return res.status(403).json({ error: 'Access denied' });
        
        // Проверка пароля администратора
        const validPassword = await bcrypt.compare(adminPassword, admin.rows[0].password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        // Хеширование нового пароля
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Обновление пароля
        await pool.query(
            'UPDATE users SET password = $1 WHERE login = $2',
            [hashedPassword, targetLogin]
        );
        
        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


router.delete('/delete', async (req, res) => {
    const { adminLogin, adminPassword, targetLogin } = req.body;

    try {
        // 1. Проверка существования администратора
        const adminResult = await pool.query(
            'SELECT * FROM users WHERE login = $1 AND admin = true',
            [adminLogin]
        );

        if (adminResult.rows.length === 0) {
            return res.status(403).json({ 
                success: false,
                error: 'Доступ запрещен: недостаточно прав' 
            });
        }

        // 2. Проверка пароля администратора
        const validPassword = await bcrypt.compare(
            adminPassword, 
            adminResult.rows[0].password
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные администратора'
            });
        }

        // 3. Проверка попытки удалить себя
        if (adminLogin === targetLogin) {
            return res.status(400).json({
                success: false,
                error: 'Нельзя удалить самого себя'
            });
        }

        // 4. Проверка существования целевого пользователя
        const targetUser = await pool.query(
            'SELECT * FROM users WHERE login = $1',
            [targetLogin]
        );

        if (targetUser.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // 5. Проверка что удаляемый не администратор
        if (targetUser.rows[0].admin) {
            return res.status(403).json({
                success: false,
                error: 'Нельзя удалить администратора'
            });
        }

        // 6. Удаление пользователя
        await pool.query(
            'DELETE FROM users WHERE login = $1',
            [targetLogin]
        );

        res.json({
            success: true,
            message: `Пользователь ${targetLogin} успешно удален`
        });

    } catch (err) {
        console.error('Ошибка при удалении пользователя:', err);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});

router.post('/update-test-results', async (req, res) => {
    const { login, password, test_date, test_id, score } = req.body;

    try {
        // 1. Проверка входных данных
        if (!login || !password || !test_date || !test_id || !score) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        // 2. Поиск пользователя по логину
        const userResult = await pool.query(
            'SELECT * FROM users WHERE $1 = ANY(login)',
            [login]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = userResult.rows[0];

        // 3. Проверка пароля
        const validPassword = await bcrypt.compare(password, user.password[0]);
        if (!validPassword) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        // 4. Создание записи о тесте
        const testEntry = {
            test_id,
            date: test_date,
            score,
            details: { 
                status: "completed",
                attempts: 1 
            }
        };

        // 5. Обновление данных
        const updateQuery = `
            UPDATE users 
            SET 
                testinfo = testinfo || $1::jsonb,
                score = score + $2
            WHERE $3 = ANY(login)
            RETURNING testinfo, score
        `;

        const updateResult = await pool.query(updateQuery, [
            JSON.stringify([testEntry]),
            score,
            login
        ]);

        // 6. Отправка результата
        res.json({
            success: true,
            new_score: updateResult.rows[0].score,
            updated_tests: updateResult.rows[0].testinfo
        });

    } catch (err) {
        console.error('Ошибка обновления:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.post('/test-result', async (req, res) => {
    const { login, testid, score } = req.body;
  
    try {
      // 1. Получаем текущие тесты пользователя
      const userRes = await pool.query(
        'SELECT test_info FROM users WHERE login = $1',
        [login]
      );
  
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
  
      const currentTests = userRes.rows[0].test_info;
  
      // 2. Обновляем нужный тест
      const updatedTests = currentTests.map((test) =>
        test.testid === testid
          ? { ...test, passed: true, score }
          : test
      );
  
      // 3. Обновляем поле в БД
      await pool.query(
        'UPDATE users SET test_info = $1 WHERE login = $2',
        [updatedTests, login]
      );
  
      res.json({ message: 'Результат теста успешно сохранён' });
    } catch (err) {
      console.error('Ошибка обновления test_info:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
  

// Получение всех пользователей
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT login, admin, test_info FROM users ORDER BY login ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка при получении пользователей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
