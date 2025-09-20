<?php
// file: App/Controllers/ProfileController.php
namespace App\Controllers;

class ProfileController extends BaseController
{
    public function show(): void
    {
        $this->requireAuth();
        // render profile view
        require __DIR__ . '/../Views/profile.php';
    }
}
