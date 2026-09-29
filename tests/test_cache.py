from yt_finder.cache import make_cache_key
from yt_finder.config import FinderConfig


def test_cache_key_changes_with_filters():
    base = FinderConfig()
    assert make_cache_key("캠핑", base) != make_cache_key("캠핑", FinderConfig(min_subscribers=5000))
    assert make_cache_key("캠핑", base) != make_cache_key("캠핑", FinderConfig(published_within_days=7))


def test_cache_key_ignores_case_but_not_priority():
    assert make_cache_key("Camping", FinderConfig()) == make_cache_key("camping ", FinderConfig())
    assert make_cache_key("캠핑", FinderConfig()) != make_cache_key("캠핑", FinderConfig(priority="latest"))
