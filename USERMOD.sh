# Хто у тебе веб-користувач:
ps aux | egrep 'php-fpm: pool|apache2|nginx' | awk '{print $1}' | sort -u

# Дамо групі www-data права на storage
sudo chgrp -R www-data /var/www/html/calendar.localhost/storage
sudo find /var/www/html/calendar.localhost/storage -type d -exec chmod 2770 {} \;
sudo find /var/www/html/calendar.localhost/storage -type f -exec chmod 660 {} \;

# Перевірка від імені веб-користувача:
sudo -u www-data php -r 'echo "DIR: ", is_writable("/var/www/html/calendar.localhost/storage/data") ? "OK\n":"NO\n";'
sudo -u www-data php -r 'echo "FILE: ", file_exists("/var/www/html/calendar.localhost/storage/data/users.json") ? (is_writable("/var/www/html/calendar.localhost/storage/data/users.json")?"OK\n":"NO\n") : "MISSING\n";'

# 0) Переконайся, що твоя сесія вже бачить групу www-data
id

# Якщо в списку груп немає www-data — перезайди в систему
# або в цьому терміналі виконай:
newgrp www-data

# 1) Власник/група на storage
sudo chown -R $USER:www-data /var/www/html/calendar.localhost/storage

# 2) Права: директ. 2775 (rwx+rwx+setgid), файли 664
sudo find /var/www/html/calendar.localhost/storage -type d -exec chmod 2775 {} \;
sudo find /var/www/html/calendar.localhost/storage -type f -exec chmod 664 {} \;

# 3) (Опційно, але зручно) ACL, щоб і ти, і www-data завжди мали rwx
sudo setfacl -R -m u:$USER:rwx -m u:www-data:rwx /var/www/html/calendar.localhost/storage
sudo setfacl -R -d -m u:$USER:rwx -m u:www-data:rwx /var/www/html/calendar.localhost/storage

# 4) Доступність батьківських папок для проходу
sudo chmod 755 /var/www /var/www/html /var/www/html/calendar.localhost
