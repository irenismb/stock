import calculadora


def test_suma():
    assert calculadora.suma(2, 3) == 5


def test_resta():
    assert calculadora.resta(5, 3) == 2


def test_multiplicacion():
    assert calculadora.multiplicacion(2, 3) == 6


def test_division():
    assert calculadora.division(6, 3) == 2


def test_division_por_cero():
    assert calculadora.division(5, 0) == "Error: División por cero"
