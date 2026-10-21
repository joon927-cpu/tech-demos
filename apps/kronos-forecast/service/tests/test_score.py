import pytest

from score import direction_accuracy, mae, repair_ohlc


def test_mae():
    assert mae([1, 2, 3], [1, 0, 4]) == 1


def test_direction_includes_the_step_from_the_previous_close():
    # previous 1. predicted moves 0, +1, +1. actual moves 0, -1, +1. two of three match.
    assert direction_accuracy([1, 2, 3], [1, 0, 4], previous=1) == pytest.approx(2 / 3)


def test_flat_matches_only_flat():
    assert direction_accuracy([5, 5], [5, 6], previous=5) == 0.5


def test_repair_lifts_high_and_drops_low():
    assert repair_ohlc(10, 9, 11, 12) == (10, 12, 10, 12)


def test_repair_rejects_non_positive():
    with pytest.raises(ValueError):
        repair_ohlc(10, 12, 0, 11)
