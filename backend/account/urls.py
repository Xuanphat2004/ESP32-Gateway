# accountt/urls.py
from django.urls import path
from .views import login_view, protected_api, signup_view

urlpatterns = [
    path('login/', login_view),
    path('protected/', protected_api),
    path('signup/', signup_view),
]