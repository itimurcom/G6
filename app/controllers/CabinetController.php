<?php
namespace App\Controllers;

use App\core\Controller;
use App\core\Request;

class CabinetController extends Controller
{
      public function cabinet(Request $request): string {
        return $this->render('pages/cabinet', [
            'title' => 'Мій кабінет',
            'extra_css' => [
                ],
            'extra_js' => [

                ]
        ]);
    }
}
