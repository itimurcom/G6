<?php
return [
    'registration' => [
        // Modes:
        // - 'dev'       : allow selecting any role listed in 'allow_roles' (for internal/dev only)
        // - 'invite'    : allow 'admin' only if valid 'admin_invite_code' is provided
        // - 'bootstrap' : allow 'admin' only if there are currently NO admins in the system
        'mode' => 'invite',
        'allow_roles' => ['user', 'admin'],
        'admin_invite_code' => 'CHANGE_ME_ADMIN_CODE',
    ],
];
