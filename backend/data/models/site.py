from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()
# test_user = User.objects.first() 
class Site(models.Model):
    site_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    location = models.CharField(max_length=255)
    site_name = models.CharField(max_length=255)
    gateway_id = models.CharField(max_length=100, unique=True, null=True, blank=True) # co the bo trong 

    class Meta:
        db_table = 'site'
