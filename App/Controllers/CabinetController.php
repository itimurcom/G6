<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;

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
