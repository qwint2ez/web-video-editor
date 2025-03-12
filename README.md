# Веб-платформа для обработки видеоинформации

## Описание проекта
**Веб-платформа для обработки видеоинформации** — это веб-приложение, предназначенное для загрузки, редактирования и обработки видеофайлов через удобный веб-интерфейс. Платформа поддерживает базовые операции редактирования, такие как обрезка видео, добавление текста, применение фильтров и экспорт готового результата. Основная цель — создать простой и легковесный инструмент с минимальной зависимостью от внешних библиотек и фреймворков, делая акцент на самостоятельной реализации. Этот инструмент идеально подходит для пользователей, которым нужны базовые функции редактирования без установки сложных программ.

## Автор
Свидинский Александр Витальевич
353504

## Диаграмма классов
Ниже представлена диаграмма классов, описывающая архитектуру системы.

![Диаграмма классов](https://github.com/qwint2ez/web-video-editor/blob/main/web-video-redactor-uml.png)  

## Функциональные требования (Use Cases)

### 1. Загрузка видео
- **Актор**: Пользователь  
- **Предусловие**: Пользователь на главной странице.  
- **Сценарий**:  
  1. Пользователь нажимает "Загрузить видео".  
  2. Открывается диалог выбора файла.  
  3. Пользователь выбирает файл.  
  4. Видео загружается и отображается.  
- **Альтернатива**: Если формат неверный — ошибка "Недопустимый формат".  
- **Результат**: Видео готово к редактированию.

### 2. Обрезка видео
- **Актор**: Пользователь  
- **Предусловие**: Видео загружено.  
- **Сценарий**:  
  1. Пользователь выбирает "Обрезать".  
  2. Появляются ползунки для выбора времени.  
  3. Пользователь задаёт интервал и нажимает "Применить".  
  4. Видео обрезается.  
- **Альтернатива**: Если интервал неверный — ошибка "Недопустимый диапазон".  
- **Результат**: Видео обрезано.

### 3. Добавление текста
- **Актор**: Пользователь  
- **Предусловие**: Видео загружено.  
- **Сценарий**:  
  1. Пользователь выбирает "Добавить текст".  
  2. Вводит текст и позицию.  
  3. Нажимает "Применить".  
  4. Текст появляется на видео.  
- **Альтернатива**: Если текст пуст — ошибка "Поле не может быть пустым".  
- **Результат**: Текст добавлен.

### 4. Применение фильтра
- **Актор**: Пользователь  
- **Предусловие**: Видео загружено.  
- **Сценарий**:  
  1. Пользователь выбирает "Применить фильтр".  
  2. Выбирает фильтр (например, чёрно-белый).  
  3. Нажимает "Применить".  
  4. Фильтр применяется.  
- **Альтернатива**: Если фильтр не выбран — ошибка "Выберите фильтр".  
- **Результат**: Фильтр применён.

### 5. Экспорт видео
- **Актор**: Пользователь  
- **Предусловие**: Видео обработано.  
- **Сценарий**:  
  1. Пользователь нажимает "Экспорт".  
  2. Выбирает формат и качество.  
  3. Нажимает "Сохранить".  
  4. Получает ссылку на скачивание.  
- **Альтернатива**: Если настройки не выбраны — ошибка "Выберите настройки".  
- **Результат**: Видео экспортировано.
