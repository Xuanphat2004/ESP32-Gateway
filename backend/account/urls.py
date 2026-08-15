# accountt/urls.py
from django.urls import path
from .views import login_view, signup_view, logout_view, me_view
from .admin_views import (
    list_users, create_user, update_user,
    set_user_active, reset_user_password, get_user_login_history, impersonate_user,
    delete_user,
)

urlpatterns = [
    path('login/', login_view),
    path('signup/', signup_view),
    path('logout/', logout_view),
    path('me/', me_view),
    path('admin/users/', list_users),
    path('admin/users/create/', create_user),
    path('admin/users/<int:user_id>/update/', update_user),
    path('admin/users/<int:user_id>/set-active/', set_user_active),
    path('admin/users/<int:user_id>/reset-password/', reset_user_password),
    path('admin/users/<int:user_id>/login-history/', get_user_login_history),
    path('admin/users/<int:user_id>/impersonate/', impersonate_user),
    path('admin/users/<int:user_id>/delete/', delete_user),
]
