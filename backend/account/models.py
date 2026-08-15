from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class LoginHistory(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_history')
    timestamp  = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'login_history'
        ordering = ['-timestamp']


class UserPresence(models.Model):
    user      = models.OneToOneField(User, on_delete=models.CASCADE, related_name='presence')
    last_seen = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'user_presence'
